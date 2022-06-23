import { expect } from 'chai';

import * as anchor from '@project-serum/anchor';
import { BorshCoder, Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';
import { AccountMeta, Connection, PublicKey, Transaction } from '@solana/web3.js';

const createTestTransferTransaction = async (authority: PublicKey, recipient: PublicKey) => {
  return anchor.web3.SystemProgram.transfer(
    {
      fromPubkey: authority,
      lamports: 1000000,
      toPubkey: recipient
    }
  );
};

const createExecuteTransactionTx = async (program, keys, feePayer) => {
  const {blockhash} = await program.provider.connection.getLatestBlockhash();
  const lastValidBlockHeight = await program.provider.connection.getBlockHeight();

  const executeTx = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer
  });
  
  const sig = anchor.utils.sha256.hash("global:execute_transaction");
  const ixDiscriminator = Buffer.from(sig, "hex");
  console.log(program.programId.toBase58());
  const executeIx = new anchor.web3.TransactionInstruction({
    programId: program.programId,
    keys,
    data: ixDiscriminator.slice(0,16)
  });
  executeTx.add(executeIx);
  return executeTx;
};

const getMsPDA = (creator: PublicKey, programId: PublicKey) => PublicKey.findProgramAddressSync([
  anchor.utils.bytes.utf8.encode("squad"),
  creator.toBuffer(),
  anchor.utils.bytes.utf8.encode("multisig")
], programId);

const getTxPDA = async (msPDA: PublicKey, txIndexBN: anchor.BN, programId: PublicKey) => await PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  msPDA.toBuffer(),
  txIndexBN.toBuffer("le",4),
  anchor.utils.bytes.utf8.encode("transaction")
], programId);

const getIxPDA =  async(txPDA: PublicKey, iXIndexBN: anchor.BN, programId: PublicKey) => await PublicKey.findProgramAddress([
  anchor.utils.bytes.utf8.encode("squad"),
  txPDA.toBuffer(),
  iXIndexBN.toBuffer("le",1),  // note instruction index is a u8 (1 byte)
  anchor.utils.bytes.utf8.encode("instruction")
], programId);

describe('Basic functionality', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
  const programProvider = program.provider as anchor.AnchorProvider;

  const creator = programProvider.wallet;
  // the Multisig PDA to use for the test run
  const [msPDA] = getMsPDA(creator.publicKey, program.programId); 

  it(`Create Multisig - MS: ${msPDA.toBase58()}`, async () => {
    const member1 = anchor.web3.Keypair.generate();
    const member2 = anchor.web3.Keypair.generate();
    const member3 = anchor.web3.Keypair.generate();
    await program.methods.create(1, [member1.publicKey, member2.publicKey, member3.publicKey])
      .accounts({
        multisig: msPDA,
        creator: creator.publicKey,
    })
    .rpc();

    let msState = await program.account.ms.fetch(msPDA);
    expect(msState.threshold).to.equal(1);
    expect(msState.transactionIndex).to.equal(0);
  });


  it.skip(`Create Tx draft - MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    // get the state of the MS
    let msState = await program.account.ms.fetch(msPDA);
    
    // increment the transaction index
    const newTxIndex = msState.transactionIndex + 1;
    const newTxIndexBN = new anchor.BN(msState.transactionIndex + 1, 10);

    // generate the tx pda
    const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);

    await program.methods.createTransaction(1)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    let txState = await program.account.msTransaction.fetch(txPDA);
    expect(txState.instructionIndex).to.equal(0);
    expect(txState.creator.toBase58()).to.equal(creator.publicKey.toBase58());

    // check the transaction indexes match
    msState = await program.account.ms.fetch(msPDA);
    expect(txState.transactionIndex).to.equal(msState.transactionIndex);
  });

  it.skip(`Add Ix to Tx - MS: ${msPDA.toBase58()}`, async () => {
     // create an transaction draft
     // get the state of the MS
     let msState = await program.account.ms.fetch(msPDA);
     
     // increment the transaction index
     const newTxIndex = msState.transactionIndex + 1;
     const newTxIndexBN = new anchor.BN(newTxIndex, 10);

     // generate the tx pda
     const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);
 
     await program.methods.createTransaction(1)
       .accounts({
         multisig: msPDA,
         transaction: txPDA,
         creator: creator.publicKey
       })
       .rpc();
 
      let txState = await program.account.msTransaction.fetch(txPDA);
      
      // check the transaction indexes match
      msState = await program.account.ms.fetch(msPDA);
      expect(msState.transactionIndex).to.equal(txState.transactionIndex); 
      expect(txState.instructionIndex).to.equal(0);
      expect(txState.status).to.have.property("draft");

      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await PublicKey.findProgramAddress([
        anchor.utils.bytes.utf8.encode("squad"),
        txPDA.toBuffer(),
        newIxIndexBN.toBuffer("le",1),  // note instruction index is a u8 (1 byte)
        anchor.utils.bytes.utf8.encode("instruction")
      ], program.programId);

      const testIx = await createTestTransferTransaction( msPDA, creator.publicKey);
      // add the instruction to the transaction
      await program.methods.addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey
        })
        .rpc();

      let ixState = await program.account.msInstruction.fetch(ixPDA);
      txState = await program.account.msTransaction.fetch(txPDA);
      expect(ixState.instructionIndex).to.equal(newIxIndex);
      expect(txState.instructionIndex).to.equal(newIxIndex);

  });

  it.skip(`Tx Activate MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    // get the state of the MS
    let msState = await program.account.ms.fetch(msPDA);
    
    // increment the transaction index
    const newTxIndex = msState.transactionIndex + 1;
    const newTxIndexBN = new anchor.BN(newTxIndex, 10);

    // generate the tx pda
    const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);

    await program.methods.createTransaction(1)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

     let txState = await program.account.msTransaction.fetch(txPDA);
     
     // check the transaction indexes match
     msState = await program.account.ms.fetch(msPDA);

     // increment the instruction index for this transaction (for new PDA)
     const newIxIndex = txState.instructionIndex + 1;
     const newIxIndexBN = new anchor.BN(newIxIndex, 10);

     // create the instruction pda
     const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

     // the test transfer instruction
     const testIx = await createTestTransferTransaction( msPDA, creator.publicKey);

     // add the instruction to the transaction
     await program.methods.addInstruction(testIx)
       .accounts({
         multisig: msPDA,
         transaction: txPDA,
         instruction: ixPDA,
         creator: creator.publicKey
       })
       .rpc();

     txState = await program.account.msTransaction.fetch(txPDA);

     await program.methods.activateTransaction()
       .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
       })
       .rpc();

    txState = await program.account.msTransaction.fetch(txPDA);
    expect(txState.status).to.have.property("active");

    let ixState = await program.account.msInstruction.fetch(ixPDA);
    expect(ixState.programId.toBase58()).to.equal(testIx.programId.toBase58());

 });

  it.skip(`Tx Sign MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    // get the state of the MS
    let msState = await program.account.ms.fetch(msPDA);
    
    // increment the transaction index
    const newTxIndex = msState.transactionIndex + 1;
    const newTxIndexBN = new anchor.BN(newTxIndex, 10);

    // generate the tx pda
    const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);

    await program.methods.createTransaction(1)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    let txState = await program.account.msTransaction.fetch(txPDA);
    
    // check the transaction indexes match
    msState = await program.account.ms.fetch(msPDA);

    // increment the instruction index for this transaction (for new PDA)
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);

    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

    // the test transfer instruction
    const testIx = await createTestTransferTransaction( msPDA, creator.publicKey);

    // add the instruction to the transaction
    await program.methods.addInstruction(testIx)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ixPDA,
        creator: creator.publicKey
      })
      .rpc();

    txState = await program.account.msTransaction.fetch(txPDA);

    await program.methods.activateTransaction()
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    txState = await program.account.msTransaction.fetch(txPDA);
    expect(txState.status).to.have.property("active");

    let ixState = await program.account.msInstruction.fetch(ixPDA);
    expect(ixState.programId.toBase58()).to.equal(testIx.programId.toBase58());

    try {
      await program.methods.approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey
        })
        .rpc();
    } catch (e) {
      console.log(e);
    }

    txState = await program.account.msTransaction.fetch(txPDA);
    expect(txState.approved.length).to.equal(1);
    expect(txState.status).to.have.property("executeReady");
  });

  it(`Tx Execute MS: ${msPDA.toBase58()}`, async () => {
    // create authority to use (Vault, index 1)
    const authorityIndexBN = new anchor.BN(1,10);
    const [authorityPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      authorityIndexBN.toBuffer("le",4),  // note instruction index is a u8 (1 byte)
      anchor.utils.bytes.utf8.encode("authority")
    ], program.programId);
  
    // get the state of the MS
    let msState = await program.account.ms.fetch(msPDA);
    
    // increment the transaction index
    const newTxIndex = msState.transactionIndex + 1;
    const newTxIndexBN = new anchor.BN(newTxIndex, 10);

    // generate the tx pda
    const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);

    await program.methods.createTransaction(1)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    let txState = await program.account.msTransaction.fetch(txPDA);
    
    // check the transaction indexes match
    msState = await program.account.ms.fetch(msPDA);

    // increment the instruction index for this transaction (for new PDA)
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);

    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

    console.log("FIRST IX PDA", ixPDA.toBase58());
    // the test transfer instruction
    const testPayee = anchor.web3.Keypair.generate();
    const testIx = await createTestTransferTransaction( authorityPDA, testPayee.publicKey);

    // add the instruction to the transaction
    await program.methods.addInstruction(testIx)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ixPDA,
        creator: creator.publicKey
      })
      .rpc();

    await program.methods.activateTransaction()
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    try {
      await program.methods.approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey
        })
        .rpc();
    } catch (e) {
      console.log(e);
    }

    // transfer lamports to the authorityPDA
    let testPayeeAccount= await program.provider.connection.getParsedAccountInfo(testPayee.publicKey);
    console.log("testPayee address", testPayee.publicKey.toBase58());
    console.log("testPayee initial account", testPayeeAccount.value);
    // move funds to auth/vault
    const moveFundsToMsPDAIx =  await createTestTransferTransaction(creator.publicKey, authorityPDA);
    const {blockhash} = await program.provider.connection.getLatestBlockhash();
    const lastValidBlockHeight = await program.provider.connection.getBlockHeight();
    const moveFundsToMsPDATx = new anchor.web3.Transaction({blockhash, lastValidBlockHeight});
    moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
    try {      
      creator.signTransaction(moveFundsToMsPDATx);
      await programProvider.sendAndConfirm(moveFundsToMsPDATx);
      const msPDAFunded = await program.provider.connection.getAccountInfo(authorityPDA);
      expect(msPDAFunded.lamports).to.equal(1000000);
      console.log("authority pda", authorityPDA.toBase58());
      console.log("authorityAccount funded with: ", msPDAFunded.lamports);
    }
    catch (e) {
      console.log(e);
    }

    // get the TX
    txState = await program.account.msTransaction.fetch(txPDA);

    const ixList = await Promise.all([...new Array(txState.instructionIndex)].map(async (a,i) => {
      const ixIndexBN = new anchor.BN(i + 1,10);
      const [ixKey] =  await getIxPDA(txPDA, ixIndexBN, program.programId);
      const ixAccount= await program.account.msInstruction.fetch(ixKey);
      return {pubkey: ixKey, ixItem: ixAccount};
    }));

    const ixKeysList= ixList.map(({pubkey, ixItem}, ixIndex) => {      
      const ixKeys: AccountMeta[] = ixItem.keys as AccountMeta[];

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
      pubkey: msPDA,
      isSigner: false,
      isWritable: true
    },
    {
      pubkey: txPDA,
      isSigner: false,
      isWritable: true,
    },
    {
      pubkey: creator.publicKey,
      isSigner: true,
      isWritable: true,
    },
    {
      pubkey: anchor.web3.SystemProgram.programId,
      isSigner: false,
      isWritable: false
    }
  ];
    executeKeys = executeKeys.concat(ixKeysList);
  
    const executeTx = await createExecuteTransactionTx(program, executeKeys, creator.publicKey);

    creator.signTransaction(executeTx);
    try {
     const res = await programProvider.sendAndConfirm(executeTx);
     console.log(res);
    } catch (e) {
      console.log(e);
    }

    msState = await program.account.ms.fetch(msPDA);
    txState = await program.account.msTransaction.fetch(txPDA);

    expect(msState.processedIndex).to.equal(txState.transactionIndex);
    expect(txState.status).to.have.property("executed");
    testPayeeAccount = await program.provider.connection.getParsedAccountInfo(testPayee.publicKey);
    expect(testPayeeAccount.value.lamports).to.equal(1000000);
  });

});