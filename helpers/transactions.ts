import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { Account } from '@solana/web3.js';
import { SquadsMpl } from '../target/types/squads_mpl';
import { ProgramManager } from '../target/types/program_manager';

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

  return new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer
  });
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

    //  [ix ix_account, ix program_id, key1, key2 ...]
    const keysUnique = ixKeysList.reduce((prev,curr) => {
        const inList = prev.findIndex(a => a.pubkey.toBase58() === curr.pubkey.toBase58());
        // if its already in the list, and has same write flag
        if ( inList >= 0 && prev[inList].isWritable === curr.isWritable){
            return prev;
        }else{
            prev.push({pubkey: curr.pubkey, isWritable: curr.isWritable, isSigner: curr.isSigner});
            return prev;
        }
    },[]);

    const keyIndexMap = ixKeysList.map(a => {
        return keysUnique.findIndex(k => {
            if (k.pubkey.toBase58() === a.pubkey.toBase58() && k.isWritable === a.isWritable) {
                return true;
            }
            return false;
        });
    });
    // console.log('ix key mapping', keyIndexMap);
    const keyIndexMapLengthBN = new anchor.BN(keyIndexMap.length, 10);
    const keyIndexMapLengthBuffer = keyIndexMapLengthBN.toArrayLike(Buffer, "le",2);
    const keyIndexMapBuffer = Buffer.from(keyIndexMap);

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
    }
  ];
//   const keys = executeKeys.concat(ixKeysList);
  const keys = executeKeys.concat(keysUnique);
  const {blockhash} = await program.provider.connection.getLatestBlockhash();
  const lastValidBlockHeight = await program.provider.connection.getBlockHeight();

  const executeTx = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer
  });

  const sig = anchor.utils.sha256.hash("global:execute_transaction");
  const ixDiscriminator = Buffer.from(sig, "hex");

  const data = Buffer.concat([ixDiscriminator.slice(0,16), keyIndexMapLengthBuffer, keyIndexMapBuffer]);
  const executeIx = await program.methods.executeTransaction(Buffer.from(keyIndexMap))
    .accounts({multisig: ms, transaction: tx, member: feePayer})
    .instruction();
  executeIx.keys = executeIx.keys.concat(keysUnique);
  executeTx.add(executeIx);
  return executeTx;
};

// some PDA helper functions
export const getMsPDA = (create_key: anchor.web3.PublicKey, programId: anchor.web3.PublicKey) => anchor.web3.PublicKey.findProgramAddressSync([
  anchor.utils.bytes.utf8.encode("squad"),
  create_key.toBuffer(),
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
  iXIndexBN.toBuffer("le",1),  // note instruction index is an u8 (1 byte)
  anchor.utils.bytes.utf8.encode("instruction")
], programId);

export const getAuthorityPDA = async (msPDA: anchor.web3.PublicKey, authorityIndexBN: anchor.BN, programId: anchor.web3.PublicKey) => await anchor.web3.PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  msPDA.toBuffer(),
  authorityIndexBN.toBuffer("le",4),  // note authority index is an u32 (4 byte)
  anchor.utils.bytes.utf8.encode("authority")
], programId);

// basic helpers
export const getNextTxIndex = async (program:  Program<SquadsMpl>, msAddress: anchor.web3.PublicKey) => {
  const msState = await program.account.ms.fetch(msAddress);
  return msState.transactionIndex + 1;
};

// program manager helpers
export const getProgramManagerPDA = (msPDA: anchor.web3.PublicKey, programId: anchor.web3.PublicKey) => anchor.web3.PublicKey.findProgramAddressSync([
  anchor.utils.bytes.utf8.encode("squad"),
  msPDA.toBuffer(),
  anchor.utils.bytes.utf8.encode("pmanage")
], programId);

export const getManagedProgramPDA = async (programManagerPDA: anchor.web3.PublicKey, managedProgramIndexBN: anchor.BN, programId: anchor.web3.PublicKey) => await anchor.web3.PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  programManagerPDA.toBuffer(),
  managedProgramIndexBN.toBuffer("le",4),  // note authority index is an u32 (4 byte)
  anchor.utils.bytes.utf8.encode("program")
], programId);

export const getProgramUpgradePDA = async (managedProgramPDA: anchor.web3.PublicKey, upgradeIndexBN: anchor.BN, programId: anchor.web3.PublicKey) => await anchor.web3.PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  managedProgramPDA.toBuffer(),
  upgradeIndexBN.toBuffer("le",4),  // note authority index is an u32 (4 byte)
  anchor.utils.bytes.utf8.encode("pupgrade")
], programId);

export const getNextProgramIndex = async (program:  Program<ProgramManager>, pmAddress: anchor.web3.PublicKey) => {
  const pmState = await program.account.programManager.fetch(pmAddress);
  return pmState.managedProgramIndex + 1;
};

export const getNextUpgradeIndex = async (program:  Program<ProgramManager>, mpAddress: anchor.web3.PublicKey) => {
  const mpState = await program.account.managedProgram.fetch(mpAddress);
  return mpState.upgradeIndex + 1;
};