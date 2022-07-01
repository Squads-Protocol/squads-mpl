import { expect } from 'chai';

import * as anchor from '@project-serum/anchor';
import { BorshCoder, Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';
import { AccountMeta, Connection, LAMPORTS_PER_SOL, PublicKey, Transaction } from '@solana/web3.js';


// some TX/IX helper functions
const createTestTransferTransaction = async (authority: PublicKey, recipient: PublicKey, amount = 1000000) => {
  return anchor.web3.SystemProgram.transfer(
    {
      fromPubkey: authority,
      lamports: amount,
      toPubkey: recipient
    }
  );
};

const createBlankTransaction = async (program, feePayer) =>{
  const {blockhash} = await program.provider.connection.getLatestBlockhash();
  const lastValidBlockHeight = await program.provider.connection.getBlockHeight();

  const tX = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer
  });
  return tX;
};


const createExecuteTransactionTx = async (program, ms, tx, feePayer) => {
    const txState = await program.account.msTransaction.fetch(tx);

    const ixList = await Promise.all([...new Array(txState.instructionIndex)].map(async (a,i) => {
      const ixIndexBN = new anchor.BN(i + 1,10);
      const [ixKey] =  await getIxPDA(tx, ixIndexBN, program.programId);
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

// basic helpers
const getNextTxIndex = async (program:  Program<SquadsMpl>, msAddress: PublicKey) => {
  const msState = await program.account.ms.fetch(msAddress);
  return msState.transactionIndex + 1;
};

// test suite
describe('Basic functionality', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
  const programProvider = program.provider as anchor.AnchorProvider;

  const creator = programProvider.wallet;
  // the Multisig PDA to use for the test run
  const [msPDA] = getMsPDA(creator.publicKey, program.programId);

  let txCount = 0;
  const numberOfMembersTotal = 10;
  it(`Create Multisig - MS: ${msPDA.toBase58()}`, async () => {
    const memberList = [...new Array(numberOfMembersTotal - 1)].map(()=>{
      return anchor.web3.Keypair.generate().publicKey;
    })
    await program.methods.create(1, memberList)
      .accounts({
        multisig: msPDA,
        creator: creator.publicKey,
    })
    .rpc();

    let msState = await program.account.ms.fetch(msPDA);
    expect(msState.threshold).to.equal(1);
    expect(msState.transactionIndex).to.equal(0);
    expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal);
  });


  it(`Create Tx draft - MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    const newTxIndex = await getNextTxIndex(program, msPDA);
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
    txCount++;
    expect(txState.instructionIndex).to.equal(0);
    expect(txState.creator.toBase58()).to.equal(creator.publicKey.toBase58());

    // check the transaction indexes match
    const msState = await program.account.ms.fetch(msPDA);
    expect(txState.transactionIndex).to.equal(msState.transactionIndex);
  });

  it(`Add Ix to Tx - MS: ${msPDA.toBase58()}`, async () => {
     // create an transaction draft
     // get the state of the MS
     const newTxIndex = await getNextTxIndex(program, msPDA);
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
      txCount++;
      // check the transaction indexes match
      const msState = await program.account.ms.fetch(msPDA);
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

  it(`Tx Activate MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    const newTxIndex = await getNextTxIndex(program, msPDA);
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
     txCount++;
     // check the transaction indexes match
     const msState = await program.account.ms.fetch(msPDA);

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

  it(`Tx Sign MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    const newTxIndex = await getNextTxIndex(program, msPDA);
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
    txCount++;
    // check the transaction indexes match
    const msState = await program.account.ms.fetch(msPDA);

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

  it(`Transfer Tx Execute MS: ${msPDA.toBase58()}`, async () => {
    // create authority to use (Vault, index 1)
    const authorityIndexBN = new anchor.BN(1,10);
    const [authorityPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      authorityIndexBN.toBuffer("le",4),  // note instruction index is a u8 (1 byte)
      anchor.utils.bytes.utf8.encode("authority")
    ], program.programId);

    const newTxIndex = await getNextTxIndex(program, msPDA);
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
    txCount++;
    // check the transaction indexes match
    let msState = await program.account.ms.fetch(msPDA);

    // increment the instruction index for this transaction (for new PDA)
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);

    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

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
    }
    catch (e) {
      console.log(e);
    }

    const executeTx = await createExecuteTransactionTx(program, msPDA, txPDA, creator.publicKey);

    creator.signTransaction(executeTx);
    try {
     const res = await programProvider.sendAndConfirm(executeTx);
    } catch (e) {
      console.log(e);
    }

    msState = await program.account.ms.fetch(msPDA);
    txState = await program.account.msTransaction.fetch(txPDA);

    expect(txState.status).to.have.property("executed");
    testPayeeAccount = await program.provider.connection.getParsedAccountInfo(testPayee.publicKey);
    expect(testPayeeAccount.value.lamports).to.equal(1000000);
  });

  it(`2X Transfer Tx Execute MS: ${msPDA.toBase58()}`, async () => {
    // create authority to use (Vault, index 1)
    const authorityIndexBN = new anchor.BN(1,10);
    const [authorityPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      authorityIndexBN.toBuffer("le",4),  // note instruction index is a u8 (1 byte)
      anchor.utils.bytes.utf8.encode("authority")
    ], program.programId);

    // get the state of the MS
    const newTxIndex = await getNextTxIndex(program, msPDA);
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
    txCount++;
    // check the transaction indexes match
    let msState = await program.account.ms.fetch(msPDA);

    // person/entity who gets paid
    const testPayee = anchor.web3.Keypair.generate();

    ////////////////////////////////////////////////////////
    // add the first transfer
    // increment the instruction index for this transaction (for new PDA)
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);

    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

    // the test transfer instruction
    const testIx = await createTestTransferTransaction( authorityPDA, testPayee.publicKey);

    await program.methods.addInstruction(testIx)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ixPDA,
        creator: creator.publicKey
      })
      .rpc();

    //////////////////////////////////////////////////////////
    // add the second transfer ix
    txState = await program.account.msTransaction.fetch(txPDA);
    const newIx2xIndex = txState.instructionIndex + 1;
    const newIx2xIndexBN = new anchor.BN(newIx2xIndex, 10);

    // create the instruction pda for ix 2x
    const [ix2xPDA] = await getIxPDA(txPDA, newIx2xIndexBN, program.programId);

    const testIx2x = await createTestTransferTransaction( authorityPDA, testPayee.publicKey);
    await program.methods.addInstruction(testIx2x)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ix2xPDA,
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
    let testPayeeAccount = await program.provider.connection.getParsedAccountInfo(testPayee.publicKey);
    // move funds to auth/vault
    const moveFundsToMsPDAIx =  await createTestTransferTransaction(creator.publicKey, authorityPDA, 3000000);
    const {blockhash} = await program.provider.connection.getLatestBlockhash();
    const lastValidBlockHeight = await program.provider.connection.getBlockHeight();
    const moveFundsToMsPDATx = new anchor.web3.Transaction({blockhash, lastValidBlockHeight});
    moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
    try {
      creator.signTransaction(moveFundsToMsPDATx);
      await programProvider.sendAndConfirm(moveFundsToMsPDATx);
      const msPDAFunded = await program.provider.connection.getAccountInfo(authorityPDA);
      expect(msPDAFunded.lamports).to.equal(3000000);
    }
    catch (e) {
      console.log(e);
    }

    const executeTx = await createExecuteTransactionTx(program, msPDA, txPDA, creator.publicKey);

    creator.signTransaction(executeTx);
    try {
     const res = await programProvider.sendAndConfirm(executeTx);
    } catch (e) {
      console.log(e);
    }

    msState = await program.account.ms.fetch(msPDA);
    txState = await program.account.msTransaction.fetch(txPDA);

    expect(txState.status).to.have.property("executed");
    testPayeeAccount = await program.provider.connection.getParsedAccountInfo(testPayee.publicKey);
    expect(testPayeeAccount.value.lamports).to.equal(2000000);
  });

  it('Change ms size with realloc', async () => {
     let msAccount = await program.provider.connection.getParsedAccountInfo(msPDA);
     const startRentLamports = msAccount.value.lamports;
     // increment the transaction index
     const newTxIndex = await getNextTxIndex(program, msPDA);
     const newTxIndexBN = new anchor.BN(newTxIndex, 10);
 
     // generate the tx pda
     const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);
 
    // 1 get the instruction to create a transction
    // 2 get the instruction to add a member
    // 3 get the instruction to 'activate' the tx
    // 4 send over the transaction to the ms program with 1 - 3
     // use 0 as authority index
     let createIx = await program.methods.createTransaction(0)
       .accounts({
         multisig: msPDA,
         transaction: txPDA,
         creator: creator.publicKey
       }).instruction();
 
    let newMember = anchor.web3.Keypair.generate().publicKey;
    
    let addMemberIx = await program.methods.addMember(newMember)
       .accounts({
        multisig: msPDA,
        multisigAuth: msPDA,
        transaction: txPDA,
       })
       .instruction();

    const newIxIndex = 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);
   
    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);
    let attachIx = await program.methods.addInstruction(addMemberIx)
       .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ixPDA,
        creator: creator.publicKey
       }).instruction();
    
    let activateIx = await program.methods.activateTransaction()
        .accounts({multisig: msPDA, transaction: txPDA, creator: creator.publicKey})
        .instruction();
        
    let addMemberTx = await createBlankTransaction(program, creator.publicKey);
    addMemberTx.add(createIx);
    addMemberTx.add(attachIx);
    addMemberTx.add(activateIx);

    creator.signTransaction(addMemberTx);
    try {
     const res = await programProvider.sendAndConfirm(addMemberTx);
    }catch(e){
      console.log(e);
    }

    await program.methods.approveTransaction()
      .accounts({multisig: msPDA, transaction: txPDA, member: creator.publicKey})
      .rpc();

    let txState = await program.account.msTransaction.fetch(txPDA);
    expect(txState.status).has.property("executeReady");

    const executeTx = await createExecuteTransactionTx(program, msPDA, txPDA, creator.publicKey);

    creator.signTransaction(executeTx);
    try {
    const res = await programProvider.sendAndConfirm(executeTx);
    } catch (e) {
      console.log(e);
      expect(e.message).contains("Transaction simulation failed");
    }

    const msState = await program.account.ms.fetch(msPDA);
    msAccount = await program.provider.connection.getParsedAccountInfo(msPDA);
    const endRentLamports = msAccount.value.lamports;
    expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 1);
    expect(endRentLamports).to.be.greaterThan(startRentLamports);
  });

  it('Transaction instruction failure', async () => {
    // create authority to use (Vault, index 1)
    const authorityIndexBN = new anchor.BN(1,10);
    const [authorityPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      authorityIndexBN.toBuffer("le",4),  // note instruction index is a u8 (1 byte)
      anchor.utils.bytes.utf8.encode("authority")
    ], program.programId);
 
    const newTxIndex = await getNextTxIndex(program, msPDA);
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
    txCount++;
    // check the transaction indexes match
    let msState = await program.account.ms.fetch(msPDA);
 
    // increment the instruction index for this transaction (for new PDA)
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);
 
    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);
 
    // the test transfer instruction
    const testPayee = anchor.web3.Keypair.generate();
    const testIx = await createTestTransferTransaction( authorityPDA, testPayee.publicKey, LAMPORTS_PER_SOL * 100);
 
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
 
    const executeTx = await createExecuteTransactionTx(program, msPDA, txPDA, creator.publicKey);
 
    creator.signTransaction(executeTx);
    try {
     const res = await programProvider.sendAndConfirm(executeTx);
    } catch (e) {
      expect(e.message).to.include("failed");
    }
 
    msState = await program.account.ms.fetch(msPDA);
    txState = await program.account.msTransaction.fetch(txPDA);
 
    expect(txState.status).to.have.property("executeReady");
   
   });

  it(`Change threshold test MS: ${msPDA.toBase58()}`, async () => {
    const newTxIndex = await getNextTxIndex(program, msPDA);
    const newTxIndexBN = new anchor.BN(newTxIndex, 10);

    // generate the tx pda
    const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);

    // use 0 as authority index
    await program.methods.createTransaction(0)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    // get the current tx state
    let txState = await program.account.msTransaction.fetch(txPDA);
    txCount++;
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);

    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

    // the test transfer instruction
    const testChangeThresholdIx = await program.methods.changeThreshold(2)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        multisigAuth: msPDA,
      })
      .instruction();

      // attache the change threshold ix
      await program.methods.addInstruction(testChangeThresholdIx)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ixPDA,
        creator: creator.publicKey
      })
      .rpc();

      // get the ix
      let ixState = await program.account.msInstruction.fetch(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // acitveate the tx
      await program.methods.activateTransaction()
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

      txState = await program.account.msTransaction.fetch(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await program.methods.approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey
        })
        .rpc();

      // execute the tx

    // get the TX
    txState = await program.account.msTransaction.fetch(txPDA);
    expect(txState.status).to.have.property("executeReady");

    const executeTx = await createExecuteTransactionTx(program, msPDA, txPDA, creator.publicKey);

    creator.signTransaction(executeTx);
    try {
     const res = await programProvider.sendAndConfirm(executeTx);
    } catch (e) {
      console.log(e);
    }

    const msState = await program.account.ms.fetch(msPDA);
    txState = await program.account.msTransaction.fetch(txPDA);

    expect(msState.threshold).to.equal(2);
    expect(txState.status).to.have.property("executed");

  });

  it("Insufficient approval failure", async() => {    // get the state of the MS
    const newTxIndex = await getNextTxIndex(program, msPDA);
    const newTxIndexBN = new anchor.BN(newTxIndex, 10);

    // generate the tx pda
    const [txPDA] = await getTxPDA(msPDA, newTxIndexBN, program.programId);

    // use 0 as authority index
    await program.methods.createTransaction(0)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

    // get the current tx state
    let txState = await program.account.msTransaction.fetch(txPDA);
    txCount++;
    const newIxIndex = txState.instructionIndex + 1;
    const newIxIndexBN = new anchor.BN(newIxIndex, 10);

    // create the instruction pda
    const [ixPDA] = await getIxPDA(txPDA, newIxIndexBN, program.programId);

    // the test transfer instruction
    const testChangeThresholdIx = await program.methods.changeThreshold(2)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        multisigAuth: msPDA,
      })
      .instruction();

      // attache the change threshold ix
      await program.methods.addInstruction(testChangeThresholdIx)
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        instruction: ixPDA,
        creator: creator.publicKey
      })
      .rpc();

      // get the ix
      let ixState = await program.account.msInstruction.fetch(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // acitveate the tx
      await program.methods.activateTransaction()
      .accounts({
        multisig: msPDA,
        transaction: txPDA,
        creator: creator.publicKey
      })
      .rpc();

      txState = await program.account.msTransaction.fetch(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await program.methods.approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey
        })
        .rpc();

      // execute the tx

    const executeTx = await createExecuteTransactionTx(program, msPDA, txPDA, creator.publicKey);

    creator.signTransaction(executeTx);
    try {
      const res = await programProvider.sendAndConfirm(executeTx);
    } catch (e) {
      expect(e.message).to.contain("Error processing Instruction");
    }
  });

});