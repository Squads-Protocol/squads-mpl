import { expect } from 'chai';

import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { SquadsMpl } from '../target/types/squads_mpl';
import { PublicKey } from '@solana/web3.js';
console.log("hello?");
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

  console.log("msPDA", msPDA.toBase58());

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

      // add the instruction to the transaction
      await program.methods.addInstruction(Buffer.from("Hi there"))
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey
        })
        .rpc();

  });

});
