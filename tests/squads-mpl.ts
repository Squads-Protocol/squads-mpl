import { expect } from 'chai';

import * as anchor from '@project-serum/anchor';
import { BorshCoder, Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

const createTestTransferTransaction = async (authority: PublicKey, recipient: PublicKey) => {
  return anchor.web3.SystemProgram.transfer(
    {
      fromPubkey: authority,
      lamports: 100000,
      toPubkey: recipient
    }
  );
};

describe('squads-mpl', () => {

  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
  const programProvider = program.provider as anchor.AnchorProvider;

  const creator = programProvider.wallet;
  // the Multisig PDA to use for the test run
  const [msPDA] = PublicKey.findProgramAddressSync([
    anchor.utils.bytes.utf8.encode("squad"),
    creator.publicKey.toBuffer(),
    anchor.utils.bytes.utf8.encode("multisig")
  ], program.programId);

  it(`Create multisig - MS: ${msPDA.toBase58()}`, async () => {
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
    // expect(msState.keys.length).to.equal(4);
    expect(msState.transactionIndex).to.equal(0);
  });


  it(`Create Transaction draft - MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    // get the state of the MS
    let msState = await program.account.ms.fetch(msPDA);
    
    // increment the transaction index
    const newTxIndex = msState.transactionIndex + 1;
    const newTxIndexBN = new anchor.BN(msState.transactionIndex + 1, 10);

    // generate the tx pda
    const [txPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      newTxIndexBN.toBuffer("le",4),
      anchor.utils.bytes.utf8.encode("transaction")
    ], program.programId);

    await program.methods.createTransaction()
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

  it(`Create transaction draft and add ix - MS: ${msPDA.toBase58()}`, async () => {
     // create an transaction draft
     // get the state of the MS
     let msState = await program.account.ms.fetch(msPDA);
     
     // increment the transaction index
     const newTxIndex = msState.transactionIndex + 1;
     const newTxIndexBN = new anchor.BN(newTxIndex, 10);

     // generate the tx pda
     const [txPDA] = await PublicKey.findProgramAddress([
       anchor.utils.bytes.utf8.encode("squad"),
       msPDA.toBuffer(),
       newTxIndexBN.toBuffer("le",4),
       anchor.utils.bytes.utf8.encode("transaction")
     ], program.programId);
 
     await program.methods.createTransaction()
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

  it(`Create transaction draft, add ix, activate MS: ${msPDA.toBase58()}`, async () => {
    // create an transaction draft
    // get the state of the MS
    let msState = await program.account.ms.fetch(msPDA);
    
    // increment the transaction index
    const newTxIndex = msState.transactionIndex + 1;
    const newTxIndexBN = new anchor.BN(newTxIndex, 10);

    // generate the tx pda
    const [txPDA] = await PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      msPDA.toBuffer(),
      newTxIndexBN.toBuffer("le",4),
      anchor.utils.bytes.utf8.encode("transaction")
    ], program.programId);

    await program.methods.createTransaction()
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
     const [ixPDA] = await PublicKey.findProgramAddress([
       anchor.utils.bytes.utf8.encode("squad"),
       txPDA.toBuffer(),
       newIxIndexBN.toBuffer("le",1),  // note instruction index is a u8 (1 byte)
       anchor.utils.bytes.utf8.encode("instruction")
     ], program.programId);

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
 });

});
