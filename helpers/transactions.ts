import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';


// some TX/IX helper functions
export const createTestTransferTransaction = async (authority: anchor.web3.PublicKey, recipient: anchor.web3.PublicKey, amount = 1000000) => {
  return anchor.web3.SystemProgram.transfer(
    {
      fromPubkey: authority,
      lamports: amount,
      toPubkey: recipient
    }
  );
};

export const createBlankTransaction = async (program:  Program<SquadsMpl>, feePayer: anchor.web3.PublicKey) =>{
  const {blockhash} = await program.provider.connection.getLatestBlockhash();
  const lastValidBlockHeight = await program.provider.connection.getBlockHeight();

  const tX = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer
  });
  return tX;
};


export const createExecuteTransactionTx = async (program:  Program<SquadsMpl>, ms: anchor.web3.PublicKey, tx: anchor.web3.PublicKey, feePayer: anchor.web3.PublicKey) => {
    const txState = await program.account.msTransaction.fetch(tx);

    const ixList = await Promise.all([...new Array(txState.instructionIndex)].map(async (a,i) => {
      const ixIndexBN = new anchor.BN(i + 1,10);
      const [ixKey] =  await getIxPDA(tx, ixIndexBN, program.programId);
      const ixAccount= await program.account.msInstruction.fetch(ixKey);
      return {pubkey: ixKey, ixItem: ixAccount};
    }));

    const ixKeysList= ixList.map(({pubkey, ixItem}, ixIndex) => {
      const ixKeys: anchor.web3.AccountMeta[] = ixItem.keys as anchor.web3.AccountMeta[];

      const formattedKeys = ixKeys.map((ixKey,keyInd) => {
        return {
          pubkey: ixKey.pubkey,
          isSigner: false,
          isWritable: ixKey.isWritable
        };
      });

      return [
        {pubkey, isSigner: false, isWritable: false},
        {pubkey: ixItem.programId, isSigner: false, isWritable: false},
        ...formattedKeys
      ];
    }).reduce((p,c) => p.concat(c),[])

    let executeKeys = [
    {
      pubkey: ms,
      isSigner: false,
      isWritable: true
    },
    {
      pubkey: tx,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: feePayer,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false
    }
  ];
  const keys = executeKeys.concat(ixKeysList);


  const {blockhash} = await program.provider.connection.getLatestBlockhash();
  const lastValidBlockHeight = await program.provider.connection.getBlockHeight();

  const executeTx = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer
  });

  const sig = anchor.utils.sha256.hash("global:execute_transaction");
  const ixDiscriminator = Buffer.from(sig, "hex");
  const executeIx = new anchor.web3.TransactionInstruction({
    programId: program.programId,
    keys,
    data: ixDiscriminator.slice(0,16)
  });
  executeTx.add(executeIx);
  return executeTx;
};

// some PDA helper functions
export const getMsPDA = (creator: anchor.web3.PublicKey, programId: anchor.web3.PublicKey) => anchor.web3.PublicKey.findProgramAddressSync([
  anchor.utils.bytes.utf8.encode("squad"),
  creator.toBuffer(),
  anchor.utils.bytes.utf8.encode("multisig")
], programId);

export const getTxPDA = async (msPDA: anchor.web3.PublicKey, txIndexBN: anchor.BN, programId: anchor.web3.PublicKey) => await anchor.web3.PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  msPDA.toBuffer(),
  txIndexBN.toBuffer("le",4),
  anchor.utils.bytes.utf8.encode("transaction")
], programId);

export const getIxPDA =  async(txPDA: anchor.web3.PublicKey, iXIndexBN: anchor.BN, programId: anchor.web3.PublicKey) => await anchor.web3.PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  txPDA.toBuffer(),
  iXIndexBN.toBuffer("le",1),  // note instruction index is a u8 (1 byte)
  anchor.utils.bytes.utf8.encode("instruction")
], programId);

export const getAuthorityPDA = async (msPDA: anchor.web3.PublicKey, authorityIndexBN: anchor.BN, programId: anchor.web3.PublicKey) => await anchor.web3.PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  msPDA.toBuffer(),
  authorityIndexBN.toBuffer("le",4),  // note instruction index is a u8 (1 byte)
  anchor.utils.bytes.utf8.encode("authority")
], programId);

// basic helpers
export const getNextTxIndex = async (program:  Program<SquadsMpl>, msAddress: anchor.web3.PublicKey) => {
  const msState = await program.account.ms.fetch(msAddress);
  return msState.transactionIndex + 1;
};