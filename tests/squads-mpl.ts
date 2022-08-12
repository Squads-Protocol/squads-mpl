import { expect } from "chai";
import fs from "fs";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SquadsMpl } from "../target/types/squads_mpl";
import { ProgramManager } from "../target/types/program_manager";
import {
  createBlankTransaction,
  createExecuteTransactionTx,
  createTestTransferTransaction,
  getNextProgramIndex,
  getNextTxIndex,
  getNextUpgradeIndex,
} from "../helpers/transactions";
import { execSync } from "child_process";
import { ParsedAccountData } from "@solana/web3.js";
import Squads, {
  getMsPDA,
  getIxPDA,
  getManagedProgramPDA,
  getProgramManagerPDA,
  getProgramUpgradePDA,
  getTxPDA,
  getAuthorityPDA,
} from "@sqds/sdk";

const BPF_UPGRADE_ID = new anchor.web3.PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

const deploySmpl = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/squads_mpl-keypair.json $(pwd)/target/deploy/squads_mpl.so`;
  execSync(deployCmd);
};

const deployPm = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/program_manager-keypair.json $(pwd)/target/deploy/program_manager.so`;
  execSync(deployCmd);
};

// will deploy a buffer for the program manager program
const writeBuffer = (bufferKeypair: string) => {
  const writeCmd = `solana program write-buffer --buffer ${bufferKeypair} --url localhost -v $(pwd)/target/deploy/program_manager.so`;
  execSync(writeCmd);
};

const setBufferAuthority = (
  bufferAddress: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey
) => {
  const authCmd = `solana program set-buffer-authority --url localhost ${bufferAddress.toBase58()} --new-buffer-authority ${authority.toBase58()}`;
  execSync(authCmd);
};

const setProgramAuthority = (
  programAddress: anchor.web3.PublicKey,
  authority: anchor.web3.PublicKey
) => {
  try {
    const logsCmd = `solana program show --url localhost --programs`;
    execSync(logsCmd, { stdio: "inherit" });
    const authCmd = `solana program set-upgrade-authority --url localhost ${programAddress.toBase58()} --new-upgrade-authority ${authority.toBase58()}`;
    execSync(authCmd, { stdio: "inherit" });
  } catch (e) {
    console.log(e);
    throw new Error(e);
  }
};

describe("Multisig and Programs", () => {
  console.log("Deploying programs...");
  deploySmpl();
  console.log("✔ SMPL Program deployed.");
  deployPm();
  console.log("✔ Program Manager Program deployed.");
  console.log("Finished deploying programs.");

  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
  const squads = Squads.localnet(provider.wallet, {
    commitmentOrConfig: provider.connection.commitment,
    multisigProgramId: anchor.workspace.SquadsMpl.programId,
    programManagerProgramId: anchor.workspace.ProgramManager.programId,
  });

  // the program-manager program / provider
  const programManagerProgram = anchor.workspace
    .ProgramManager as Program<ProgramManager>;

  const creator = (program.provider as anchor.AnchorProvider).wallet;
  // the Multisig PDA to use for the test run
  let randomCreateKey = anchor.web3.Keypair.generate().publicKey;
  const [msPDA] = getMsPDA(randomCreateKey, squads.multisigProgramId);
  const [pmPDA] = getProgramManagerPDA(msPDA, squads.programManagerProgramId);

  const member2 = anchor.web3.Keypair.generate();
  const numberOfMembersTotal = 10;

  const memberList = [...new Array(numberOfMembersTotal - 1)].map(() => {
    return anchor.web3.Keypair.generate();
  });

  let threshold = 1;
  // test suite
  describe("Basic functionality", () => {
    it(`Create Multisig - MS: ${msPDA.toBase58()}`, async () => {
      await program.methods
        .create(
          threshold,
          randomCreateKey,
          memberList.map((m) => m.publicKey).concat(creator.publicKey)
        )
        .accounts({
          multisig: msPDA,
          creator: creator.publicKey,
        })
        .rpc();

      const vaultIndex = new anchor.BN(1, 10);
      const [vaultPDA] = await getAuthorityPDA(
        msPDA,
        vaultIndex,
        squads.multisigProgramId
      );

      const fundingTx = await createBlankTransaction(
        program,
        creator.publicKey
      );
      const fundingIx = await createTestTransferTransaction(
        creator.publicKey,
        vaultPDA,
        0.001 * 1000000000
      );

      fundingTx.add(fundingIx);
      await creator.signTransaction(fundingTx);
      try {
        await provider.sendAndConfirm(fundingTx);
      } catch (e) {
        console.log(e);
      }

      let msState = await squads.getMultisig(msPDA);
      expect(msState.threshold).to.equal(1);
      expect(msState.transactionIndex).to.equal(0);
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal);

      const vaultAccount =
        await program.provider.connection.getParsedAccountInfo(vaultPDA);
      expect(vaultAccount.value.lamports).to.equal(0.001 * 1000000000);
    });

    it(`Create Tx draft - MS: ${msPDA.toBase58()}`, async () => {
      // create an transaction draft
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      expect(txState.instructionIndex).to.equal(0);
      expect(txState.creator.toBase58()).to.equal(creator.publicKey.toBase58());

      // check the transaction indexes match
      const msState = await squads.getMultisig(msPDA);
      expect(txState.transactionIndex).to.equal(msState.transactionIndex);
    });

    it(`Add Ix to Tx - MS: ${msPDA.toBase58()}`, async () => {
      // create an transaction draft
      // get the state of the MS
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      // check the transaction indexes match
      const msState = await squads.getMultisig(msPDA);
      expect(txState.instructionIndex).to.equal(0);
      expect(txState.status).to.have.property("draft");

      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await anchor.web3.PublicKey.findProgramAddress(
        [
          anchor.utils.bytes.utf8.encode("squad"),
          txPDA.toBuffer(),
          newIxIndexBN.toBuffer("le", 1), // note instruction index is a u8 (1 byte)
          anchor.utils.bytes.utf8.encode("instruction"),
        ],
        squads.multisigProgramId
      );

      const testIx = await createTestTransferTransaction(
        msPDA,
        creator.publicKey
      );
      // add the instruction to the transaction
      await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let ixState = await squads.getInstruction(ixPDA);
      txState = await squads.getTransaction(txPDA);
      expect(ixState.instructionIndex).to.equal(newIxIndex);
      expect(txState.instructionIndex).to.equal(newIxIndex);
    });

    it(`Tx Activate - MS: ${msPDA.toBase58()}`, async () => {
      // create an transaction draft
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      // check the transaction indexes match
      const msState = await squads.getMultisig(msPDA);

      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testIx = await createTestTransferTransaction(
        msPDA,
        creator.publicKey
      );

      // add the instruction to the transaction
      await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);

      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");
      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.programId.toBase58()).to.equal(
        testIx.programId.toBase58()
      );
    });

    it(`Tx Sign - MS: ${msPDA.toBase58()}`, async () => {
      // create an transaction draft
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      // check the transaction indexes match
      const msState = await squads.getMultisig(msPDA);

      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testIx = await createTestTransferTransaction(
        msPDA,
        creator.publicKey
      );

      // add the instruction to the transaction
      await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);

      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.programId.toBase58()).to.equal(
        testIx.programId.toBase58()
      );

      try {
        await program.methods
          .approveTransaction()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            member: creator.publicKey,
          })
          .rpc();
      } catch (e) {
        console.log(e);
      }

      txState = await squads.getTransaction(txPDA);
      expect(txState.approved.length).to.equal(1);
      expect(txState.status).to.have.property("executeReady");
    });

    it(`Transfer Tx Execute - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityIndexBN = new anchor.BN(1, 10);
      const [authorityPDA] = await getAuthorityPDA(
        msPDA,
        authorityIndexBN,
        squads.multisigProgramId
      );

      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      const createIx = await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .instruction();

      // the test transfer instruction
      const testPayee = anchor.web3.Keypair.generate();
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );

      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // add the instruction to the transaction
      const addIx = await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .instruction();

      const activateIx = await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .instruction();

      const transferTx = await createBlankTransaction(
        program,
        creator.publicKey
      );
      transferTx.add(createIx);
      transferTx.add(addIx);
      transferTx.add(activateIx);
      creator.signTransaction(transferTx);

      try {
        await provider.sendAndConfirm(transferTx);
      } catch (e) {
        console.log(e);
      }

      await program.methods
        .approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("executeReady");
      // transfer lamports to the authorityPDA
      let testPayeeAccount =
        await program.provider.connection.getParsedAccountInfo(
          testPayee.publicKey
        );
      // move funds to auth/vault
      const moveFundsToMsPDAIx = await createTestTransferTransaction(
        creator.publicKey,
        authorityPDA
      );
      const { blockhash } =
        await program.provider.connection.getLatestBlockhash();
      const lastValidBlockHeight =
        await program.provider.connection.getBlockHeight();
      const moveFundsToMsPDATx = new anchor.web3.Transaction({
        blockhash,
        lastValidBlockHeight,
      });
      moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
      try {
        creator.signTransaction(moveFundsToMsPDATx);
        await provider.sendAndConfirm(moveFundsToMsPDATx);
        const authorityPDAFunded =
          await program.provider.connection.getAccountInfo(authorityPDA);
        expect(authorityPDAFunded.lamports).to.equal(2000000);
      } catch (e) {
        console.log(e);
      }

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );

      creator.signTransaction(executeTx);
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        console.log(e);
      }

      let msState = await squads.getMultisig(msPDA);
      txState = await squads.getTransaction(txPDA);

      expect(txState.status).to.have.property("executed");
      testPayeeAccount = await program.provider.connection.getParsedAccountInfo(
        testPayee.publicKey
      );
      expect(testPayeeAccount.value.lamports).to.equal(1000000);
    });

    it(`2X Transfer Tx Execute - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityIndexBN = new anchor.BN(1, 10);
      const [authorityPDA] = await getAuthorityPDA(
        msPDA,
        authorityIndexBN,
        squads.multisigProgramId
      );

      // get the state of the MS
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);

      // check the transaction indexes match
      let msState = await squads.getMultisig(msPDA);

      // person/entity who gets paid
      const testPayee = anchor.web3.Keypair.generate();

      ////////////////////////////////////////////////////////
      // add the first transfer
      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );

      await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      //////////////////////////////////////////////////////////
      // add the second transfer ix
      txState = await squads.getTransaction(txPDA);
      const newIx2xIndex = txState.instructionIndex + 1;
      const newIx2xIndexBN = new anchor.BN(newIx2xIndex, 10);

      // create the instruction pda for ix 2x
      const [ix2xPDA] = await getIxPDA(
        txPDA,
        newIx2xIndexBN,
        squads.multisigProgramId
      );

      const testIx2x = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );
      await program.methods
        .addInstruction(testIx2x)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ix2xPDA,
          creator: creator.publicKey,
        })
        .rpc();

      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .approveTransaction()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            member: creator.publicKey,
          })
          .rpc();
      } catch (e) {
        console.log(e);
      }

      // transfer lamports to the authorityPDA
      let testPayeeAccount =
        await program.provider.connection.getParsedAccountInfo(
          testPayee.publicKey
        );
      // move funds to auth/vault
      const moveFundsToMsPDAIx = await createTestTransferTransaction(
        creator.publicKey,
        authorityPDA,
        3000000
      );
      const { blockhash } =
        await program.provider.connection.getLatestBlockhash();
      const lastValidBlockHeight =
        await program.provider.connection.getBlockHeight();
      const moveFundsToMsPDATx = new anchor.web3.Transaction({
        blockhash,
        lastValidBlockHeight,
      });
      moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
      try {
        creator.signTransaction(moveFundsToMsPDATx);
        await provider.sendAndConfirm(moveFundsToMsPDATx);
        const msPDAFunded = await program.provider.connection.getAccountInfo(
          authorityPDA
        );
        expect(msPDAFunded.lamports).to.equal(4000000);
      } catch (e) {
        console.log(e);
      }

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );

      creator.signTransaction(executeTx);
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        console.log(e);
      }

      msState = await squads.getMultisig(msPDA);
      txState = await squads.getTransaction(txPDA);

      expect(txState.status).to.have.property("executed");
      testPayeeAccount = await program.provider.connection.getParsedAccountInfo(
        testPayee.publicKey
      );
      expect(testPayeeAccount.value.lamports).to.equal(2000000);
    });

    it(`2X Transfer Tx Sequential execute - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityIndexBN = new anchor.BN(1, 10);
      const [authorityPDA] = await getAuthorityPDA(
        msPDA,
        authorityIndexBN,
        squads.multisigProgramId
      );

      // get the state of the MS
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);

      // person/entity who gets paid
      const testPayee = anchor.web3.Keypair.generate();

      ////////////////////////////////////////////////////////
      // add the first transfer
      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );

      await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      //////////////////////////////////////////////////////////
      // add the second transfer ix
      txState = await squads.getTransaction(txPDA);
      const newIx2xIndex = txState.instructionIndex + 1;
      const newIx2xIndexBN = new anchor.BN(newIx2xIndex, 10);

      // create the instruction pda for ix 2x
      const [ix2xPDA] = await getIxPDA(
        txPDA,
        newIx2xIndexBN,
        squads.multisigProgramId
      );

      const testIx2x = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );
      await program.methods
        .addInstruction(testIx2x)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ix2xPDA,
          creator: creator.publicKey,
        })
        .rpc();

      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .approveTransaction()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            member: creator.publicKey,
          })
          .rpc();
      } catch (e) {
        console.log(e);
      }

      // transfer lamports to the authorityPDA
      let testPayeeAccount =
        await program.provider.connection.getParsedAccountInfo(
          testPayee.publicKey
        );
      // move funds to auth/vault
      const moveFundsToMsPDAIx = await createTestTransferTransaction(
        creator.publicKey,
        authorityPDA,
        3000000
      );
      const { blockhash } =
        await program.provider.connection.getLatestBlockhash();
      const lastValidBlockHeight =
        await program.provider.connection.getBlockHeight();
      const moveFundsToMsPDATx = new anchor.web3.Transaction({
        blockhash,
        lastValidBlockHeight,
      });
      moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
      try {
        creator.signTransaction(moveFundsToMsPDATx);
        await provider.sendAndConfirm(moveFundsToMsPDATx);
      } catch (e) {
        console.log(e);
      }
      const msPDAFunded = await program.provider.connection.getAccountInfo(
        authorityPDA
      );
      // expect the vault to be correct:
      expect(msPDAFunded.lamports).to.equal(5000000);
      // lead with the expected program account, follow with the other accounts for the ix
      const testIx1Keys: anchor.web3.AccountMeta[] = [
        { pubkey: testIx.programId, isSigner: false, isWritable: false },
      ].concat(
        testIx.keys.map((k) => {
          k.isSigner = false;
          return k;
        })
      );
      await program.methods
        .executeInstruction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          member: creator.publicKey,
        })
        .remainingAccounts(testIx1Keys)
        .rpc();
      const ixUpdatedState = await squads.getInstruction(ixPDA);
      let txUpdatedState = await squads.getTransaction(txPDA);

      expect(ixUpdatedState.executed).to.be.true;
      expect(txUpdatedState.executedIndex).to.equal(1);

      const testIx2Keys: anchor.web3.AccountMeta[] = [
        { pubkey: testIx2x.programId, isSigner: false, isWritable: false },
      ].concat(
        testIx2x.keys.map((k) => {
          k.isSigner = false;
          return k;
        })
      );
      await program.methods
        .executeInstruction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ix2xPDA,
          member: creator.publicKey,
        })
        .remainingAccounts(testIx2Keys)
        .rpc();

      const ix2UpdatedState = await squads.getInstruction(ixPDA);
      txUpdatedState = await squads.getTransaction(txPDA);

      expect(ix2UpdatedState.executed).to.be.true;
      expect(txUpdatedState.executedIndex).to.equal(2);
      expect(txUpdatedState.status).to.have.property("executed");
    });

    it(`Change ms size with realloc - MS: ${msPDA.toBase58()}`, async () => {
      let msAccount = await program.provider.connection.getParsedAccountInfo(
        msPDA
      );
      const startRentLamports = msAccount.value.lamports;
      // increment the transaction index
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      // 1 get the instruction to create a transction
      // 2 get the instruction to add a member
      // 3 get the instruction to 'activate' the tx
      // 4 send over the transaction to the ms program with 1 - 3
      // use 0 as authority index
      let createIx = await program.methods
        .createTransaction(0)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .instruction();

      let addMemberIx = await program.methods
        .addMember(member2.publicKey)
        .accounts({
          multisig: msPDA,
          multisigAuth: msPDA,
          // transaction: txPDA,
        })
        .instruction();

      const newIxIndex = 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );
      let attachIx = await program.methods
        .addInstruction(addMemberIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .instruction();

      let activateIx = await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .instruction();

      let addMemberTx = await createBlankTransaction(
        program,
        creator.publicKey
      );
      addMemberTx.add(createIx);
      addMemberTx.add(attachIx);
      addMemberTx.add(activateIx);

      creator.signTransaction(addMemberTx);
      try {
        const res = await provider.sendAndConfirm(addMemberTx);
      } catch (e) {
        console.log(e);
      }

      await program.methods
        .approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      expect(txState.status).has.property("executeReady");

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );

      creator.signTransaction(executeTx);
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        console.log(e);
        expect(e.message).contains("Transaction simulation failed");
      }

      const msState = await squads.getMultisig(msPDA);
      msAccount = await program.provider.connection.getParsedAccountInfo(msPDA);
      const endRentLamports = msAccount.value.lamports;
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 1);
      expect(endRentLamports).to.be.greaterThan(startRentLamports);
    });

    it(`Add a new member but creator is not executor - MS: ${msPDA.toBase58()}`, async () => {
      let msAccount = await program.provider.connection.getParsedAccountInfo(
        msPDA
      );
      const startRentLamports = msAccount.value.lamports;
      // increment the transaction index
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      // 1 get the instruction to create a transction
      // 2 get the instruction to add a member
      // 3 get the instruction to 'activate' the tx
      // 4 send over the transaction to the ms program with 1 - 3
      // use 0 as authority index
      let createIx = await program.methods
        .createTransaction(0)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .instruction();

      const newMember = anchor.web3.Keypair.generate().publicKey;

      let addMemberIx = await program.methods
        .addMember(newMember)
        .accounts({
          multisig: msPDA,
          multisigAuth: msPDA,
          // transaction: txPDA,
        })
        .instruction();

      const newIxIndex = 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );
      let attachIx = await program.methods
        .addInstruction(addMemberIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .instruction();

      let activateIx = await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .instruction();

      let addMemberTx = await createBlankTransaction(
        program,
        creator.publicKey
      );
      addMemberTx.add(createIx);
      addMemberTx.add(attachIx);
      addMemberTx.add(activateIx);

      creator.signTransaction(addMemberTx);
      try {
        const res = await provider.sendAndConfirm(addMemberTx);
      } catch (e) {
        console.log(e);
      }

      await program.methods
        .approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);
      expect(txState.status).has.property("executeReady");

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        member2.publicKey
      );

      try {
        const res = await provider.sendAndConfirm(executeTx, [member2]);
      } catch (e) {
        console.log(e);
      }

      const msState = await squads.getMultisig(msPDA);
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 2);
    });

    it(`Transaction instruction failure - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityIndexBN = new anchor.BN(1, 10);
      const [authorityPDA] = await getAuthorityPDA(
        msPDA,
        authorityIndexBN,
        squads.multisigProgramId
      );

      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      let txState = await squads.getTransaction(txPDA);

      // check the transaction indexes match
      let msState = await squads.getMultisig(msPDA);

      // increment the instruction index for this transaction (for new PDA)
      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testPayee = anchor.web3.Keypair.generate();
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 100
      );

      // add the instruction to the transaction
      await program.methods
        .addInstruction(testIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      try {
        await program.methods
          .approveTransaction()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            member: creator.publicKey,
          })
          .rpc();
      } catch (e) {
        console.log(e);
      }

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );

      creator.signTransaction(executeTx);
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        // :(
        expect(e.message).to.include("failed");
      }

      msState = await squads.getMultisig(msPDA);
      txState = await squads.getTransaction(txPDA);

      expect(txState.status).to.have.property("executeReady");
    });

    it(`Change threshold test - MS: ${msPDA.toBase58()}`, async () => {
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      // use 0 as authority index
      await program.methods
        .createTransaction(0)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the current tx state
      let txState = await squads.getTransaction(txPDA);

      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testChangeThresholdIx = await program.methods
        .changeThreshold(2)
        .accounts({
          multisig: msPDA,
          // transaction: txPDA,
          multisigAuth: msPDA,
        })
        .instruction();

      // attache the change threshold ix
      await program.methods
        .addInstruction(testChangeThresholdIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the ix
      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // acitveate the tx
      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await program.methods
        .approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      // execute the tx

      // get the TX
      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("executeReady");

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );

      creator.signTransaction(executeTx);
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        console.log(e);
      }

      const msState = await squads.getMultisig(msPDA);
      txState = await squads.getTransaction(txPDA);

      expect(msState.threshold).to.equal(2);
      expect(txState.status).to.have.property("executed");
      threshold = msState.threshold;
    });

    it(`Insufficient approval failure - MS: ${msPDA.toBase58()}`, async () => {
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      // use 0 as authority index
      await program.methods
        .createTransaction(0)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the current tx state
      let txState = await squads.getTransaction(txPDA);

      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testChangeThresholdIx = await program.methods
        .changeThreshold(2)
        .accounts({
          multisig: msPDA,
          multisigAuth: msPDA,
        })
        .instruction();

      // attache the change threshold ix
      await program.methods
        .addInstruction(testChangeThresholdIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the ix
      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // acitveate the tx
      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await program.methods
        .approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      // execute the tx

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );

      creator.signTransaction(executeTx);
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        expect(e.message).to.contain("Error processing Instruction");
      }
    });

    it(`Change vote from approved to rejected - MS: ${msPDA.toBase58()}`, async () => {
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      // use 0 as authority index
      await program.methods
        .createTransaction(0)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the current tx state
      let txState = await squads.getTransaction(txPDA);

      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );

      // the test transfer instruction
      const testChangeThresholdIx = await program.methods
        .changeThreshold(2)
        .accounts({
          multisig: msPDA,
          multisigAuth: msPDA,
        })
        .instruction();

      // attache the change threshold ix
      await program.methods
        .addInstruction(testChangeThresholdIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the ix
      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // acitveate the tx
      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await program.methods
        .approveTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      // check that state is "approved"
      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");
      expect(
        txState.approved
          .map((k) => k.toBase58())
          .indexOf(creator.publicKey.toBase58())
      ).is.greaterThanOrEqual(0);

      // now reject
      await program.methods
        .rejectTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          member: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");
      expect(
        txState.rejected
          .map((k) => k.toBase58())
          .indexOf(creator.publicKey.toBase58())
      ).is.greaterThanOrEqual(0);
      expect(
        txState.approved
          .map((k) => k.toBase58())
          .indexOf(creator.publicKey.toBase58())
      ).is.lessThan(0);
    });
  });

  describe("Program upgrades", () => {
    it(`Create a program manager - MS: ${msPDA.toBase58()}`, async () => {
      try {
        await programManagerProgram.methods
          .createProgramManager()
          .accounts({
            multisig: msPDA,
            programManager: pmPDA,
          })
          .rpc();
      } catch (e) {
        console.log("eror creating program manager", e);
      }
      const newProgramManager = await squads.getProgramManager(pmPDA);
      expect(newProgramManager.multisig.toBase58()).to.equal(msPDA.toBase58());
    });

    it(`Create a program to manage - MS ${msPDA.toBase58()}`, async () => {
      const nextProgramIndex = await getNextProgramIndex(
        programManagerProgram,
        pmPDA
      );
      const testProgramAddress = anchor.web3.Keypair.generate().publicKey;
      const [mpPDA] = await getManagedProgramPDA(
        pmPDA,
        new anchor.BN(nextProgramIndex),
        programManagerProgram.programId
      );
      const nameString = "This is my test Program";
      try {
        await programManagerProgram.methods
          .createManagedProgram(testProgramAddress, nameString)
          .accounts({
            multisig: msPDA,
            programManager: pmPDA,
            managedProgram: mpPDA,
          })
          .rpc();
      } catch (e) {
        console.log("error creating managed program", e);
      }
      const newManagedProgramState = await squads.getManagedProgram(mpPDA);
      expect(newManagedProgramState.name).to.equal(nameString);
      expect(newManagedProgramState.managedProgramIndex).to.equal(
        nextProgramIndex
      );
    });

    it(`Create a program to manage and create upgrade - MS ${msPDA.toBase58()}`, async () => {
      const nextProgramIndex = await getNextProgramIndex(
        programManagerProgram,
        pmPDA
      );
      const testProgramAddress = anchor.web3.Keypair.generate().publicKey;
      const [mpPDA] = await getManagedProgramPDA(
        pmPDA,
        new anchor.BN(nextProgramIndex),
        programManagerProgram.programId
      );

      const nameString = "This is my test Program 2";
      try {
        await programManagerProgram.methods
          .createManagedProgram(testProgramAddress, nameString)
          .accounts({
            multisig: msPDA,
            programManager: pmPDA,
            managedProgram: mpPDA,
          })
          .rpc();
      } catch (e) {
        console.log("error creating managed program", e);
      }
      const newManagedProgramState = await squads.getManagedProgram(mpPDA);
      expect(newManagedProgramState.name).to.equal(nameString);
      expect(newManagedProgramState.managedProgramIndex).to.equal(
        nextProgramIndex
      );

      const nextUpgradeIndex = await getNextUpgradeIndex(
        programManagerProgram,
        mpPDA
      );
      const [upgradePDA] = await getProgramUpgradePDA(
        mpPDA,
        new anchor.BN(nextUpgradeIndex, 10),
        programManagerProgram.programId
      );

      const testBufferAddress = anchor.web3.Keypair.generate().publicKey;
      const testSpillAddress = anchor.web3.Keypair.generate().publicKey;
      const testAuthorityAddress = anchor.web3.Keypair.generate().publicKey;
      const testUpgradeName = "Upgrade #1";
      try {
        await programManagerProgram.methods
          .createProgramUpgrade(
            testBufferAddress,
            testSpillAddress,
            testAuthorityAddress,
            testUpgradeName
          )
          .accounts({
            multisig: msPDA,
            programManager: pmPDA,
            managedProgram: mpPDA,
            programUpgrade: upgradePDA,
          })
          .rpc();
      } catch (e) {
        console.log("Error creating program upgrade", e);
      }

      const addedUpgrade = await squads.getProgramUpgrade(upgradePDA);
      const managedProgramState = await squads.getManagedProgram(mpPDA);
      expect(addedUpgrade.upgradeIndex).to.equal(
        managedProgramState.upgradeIndex
      );
      expect(addedUpgrade.name).to.equal(testUpgradeName);
      expect(addedUpgrade.upgradeIx.programId.toBase58()).to.equal(
        BPF_UPGRADE_ID.toBase58()
      );
    });

    it(`Create upgrade with buffer and deploy it - MS ${msPDA.toBase58()}`, async function () {
      this.timeout(30000);
      const nextProgramIndex = await getNextProgramIndex(
        programManagerProgram,
        pmPDA
      );
      const [mpPDA] = await getManagedProgramPDA(
        pmPDA,
        new anchor.BN(nextProgramIndex),
        programManagerProgram.programId
      );
      const [vaultPDA] = await getAuthorityPDA(
        msPDA,
        new anchor.BN(1, 10),
        squads.multisigProgramId
      );

      // create a temp keypair to use
      const bufferKeypair = anchor.web3.Keypair.generate();

      // write the temp buffer keypair to file
      fs.writeFileSync(
        "tests/tmp/buffer_test_keypair.json",
        `[${bufferKeypair.secretKey.toString()}]`
      );

      // deploy/write the buffer
      writeBuffer("tests/tmp/buffer_test_keypair.json");
      // set the buffer authority to the vault
      setBufferAuthority(bufferKeypair.publicKey, vaultPDA);

      // check that the buffer has proper authority
      const parsedBufferAccount =
        await provider.connection.getParsedAccountInfo(bufferKeypair.publicKey);
      const parsedBufferData = (
        parsedBufferAccount.value.data as ParsedAccountData
      ).parsed;
      expect(parsedBufferData.type).to.equal("buffer");
      expect(parsedBufferData.info.authority).to.equal(vaultPDA.toBase58());

      // set the program authority
      setProgramAuthority(programManagerProgram.programId, vaultPDA);

      // add the program
      const nameString = "The program manager program, itself";
      try {
        await programManagerProgram.methods
          .createManagedProgram(programManagerProgram.programId, nameString)
          .accounts({
            multisig: msPDA,
            programManager: pmPDA,
            managedProgram: mpPDA,
          })
          .rpc();
      } catch (e) {
        console.log("error creating managed program", e);
      }
      const newManagedProgramState = await squads.getManagedProgram(mpPDA);
      expect(newManagedProgramState.name).to.equal(nameString);
      expect(newManagedProgramState.managedProgramIndex).to.equal(
        nextProgramIndex
      );

      // create the upgrade
      const nextUpgradeIndex = await getNextUpgradeIndex(
        programManagerProgram,
        mpPDA
      );
      const [upgradePDA] = await getProgramUpgradePDA(
        mpPDA,
        new anchor.BN(nextUpgradeIndex, 10),
        programManagerProgram.programId
      );

      const testUpgradeName = "Upgrade #1";
      try {
        await programManagerProgram.methods
          .createProgramUpgrade(
            bufferKeypair.publicKey,
            provider.wallet.publicKey,
            vaultPDA,
            testUpgradeName
          )
          .accounts({
            multisig: msPDA,
            programManager: pmPDA,
            managedProgram: mpPDA,
            programUpgrade: upgradePDA,
          })
          .rpc();
      } catch (e) {
        console.log("Error creating program upgrade", e);
      }

      // verify the upgrade account was created, and that the buffers match as well in the ix
      const addedUpgrade = await squads.getProgramUpgrade(upgradePDA);
      const managedProgramState = await squads.getManagedProgram(mpPDA);
      expect(addedUpgrade.upgradeIndex).to.equal(
        managedProgramState.upgradeIndex
      );
      expect(addedUpgrade.name).to.equal(testUpgradeName);
      // check the upgrade Ix accounts match
      expect(addedUpgrade.upgradeIx.programId.toBase58()).to.equal(
        BPF_UPGRADE_ID.toBase58()
      );
      expect(addedUpgrade.upgradeIx.accounts[1].pubkey.toBase58()).to.equal(
        programManagerProgram.programId.toBase58()
      );
      expect(addedUpgrade.upgradeIx.accounts[2].pubkey.toBase58()).to.equal(
        bufferKeypair.publicKey.toBase58()
      );
      expect(addedUpgrade.upgradeIx.accounts[3].pubkey.toBase58()).to.equal(
        provider.wallet.publicKey.toBase58()
      );
      expect(addedUpgrade.upgradeIx.accounts[6].pubkey.toBase58()).to.equal(
        vaultPDA.toBase58()
      );

      // create a new tx for the upgrade
      const newTxIndex = await getNextTxIndex(program, msPDA);
      const newTxIndexBN = new anchor.BN(newTxIndex, 10);

      // generate the tx pda
      const [txPDA] = await getTxPDA(
        msPDA,
        newTxIndexBN,
        squads.multisigProgramId
      );

      // use 1/vault as authority index
      await program.methods
        .createTransaction(1)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      // get the current tx state
      let txState = await squads.getTransaction(txPDA);

      const newIxIndex = txState.instructionIndex + 1;
      const newIxIndexBN = new anchor.BN(newIxIndex, 10);
      const newIx2IndexBN = new anchor.BN(newIxIndex + 1, 10);

      // create the instruction pda
      const [ixPDA] = await getIxPDA(
        txPDA,
        newIxIndexBN,
        squads.multisigProgramId
      );
      // create the instruction pda
      const [ix2PDA] = await getIxPDA(
        txPDA,
        newIx2IndexBN,
        squads.multisigProgramId
      );

      // the upgrade instruction
      const upgradeIx = {
        programId: addedUpgrade.upgradeIx.programId,
        data: addedUpgrade.upgradeIx.upgradeInstructionData,
        keys: addedUpgrade.upgradeIx.accounts,
      };

      // attach the upgrade ix
      const addUpgradeTx = await program.methods
        .addInstruction(upgradeIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ixPDA,
          creator: creator.publicKey,
        })
        .transaction();

      const [authorityPDA] = await getAuthorityPDA(
        msPDA,
        new anchor.BN(1, 10),
        squads.multisigProgramId
      );

      // get the upgrade update instruciton to run after the upgrade
      const updateUpgradeIx = await programManagerProgram.methods
        .setAsExecuted()
        .accounts({
          multisig: msPDA,
          programManager: pmPDA,
          managedProgram: mpPDA,
          programUpgrade: upgradePDA,
          transaction: txPDA,
          instruction: ixPDA,
          authority: authorityPDA,
        })
        .instruction();

      const addUpgradeFollowupIx = await program.methods
        .addInstruction(updateUpgradeIx)
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          instruction: ix2PDA,
          creator: creator.publicKey,
        })
        .instruction();

      addUpgradeTx.add(addUpgradeFollowupIx);

      try {
        await provider.sendAndConfirm(addUpgradeTx);
      } catch (e) {
        console.log(e);
      }

      // get the ix
      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // get the ix 2
      let ix2State = await squads.getInstruction(ix2PDA);
      expect(ix2State.instructionIndex).to.equal(2);

      txState = await squads.getTransaction(txPDA);
      expect(txState.instructionIndex).to.equal(2);

      // acitveate the tx
      await program.methods
        .activateTransaction()
        .accounts({
          multisig: msPDA,
          transaction: txPDA,
          creator: creator.publicKey,
        })
        .rpc();

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      const msState = await squads.getMultisig(msPDA);
      // if the threshold has changed, use the other members to approve as well
      for (let i = 0; i < memberList.length; i++) {
        // check to see if we need more signers
        const approvalState = await squads.getTransaction(txPDA);
        if (Object.keys(approvalState.status).indexOf("active") < 0) {
          return false;
        }

        const inMultisig = (msState.keys as anchor.web3.PublicKey[]).findIndex(
          (k) => {
            return k.toBase58() == memberList[i].publicKey.toBase58();
          }
        );
        if (inMultisig < 0) {
          return false;
        }
        try {
          await provider.connection.requestAirdrop(
            memberList[i].publicKey,
            anchor.web3.LAMPORTS_PER_SOL
          );
          const approveTx = await program.methods
            .approveTransaction()
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              member: memberList[i].publicKey,
            })
            .signers([memberList[i]])
            .transaction();
          try {
            await provider.sendAndConfirm(approveTx, [memberList[i]]);
            return true;
          } catch (e) {
            console.log(memberList[i].publicKey.toBase58(), " signing error");
            return false;
          }
        } catch (e) {
          console.log(e);
          return false;
        }
      }

      txState = await squads.getTransaction(txPDA);
      console.log("txState", txState);
      expect(txState.status).to.have.property("executeReady");

      const executeTx = await createExecuteTransactionTx(
        program,
        msPDA,
        txPDA,
        creator.publicKey
      );
      try {
        const res = await provider.sendAndConfirm(executeTx);
      } catch (e) {
        console.log(e);
      }

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("executed");
      const puState = await squads.getProgramUpgrade(upgradePDA);
      expect(puState.executed).to.be.true;
      expect(puState.upgradedOn.toNumber()).to.be.greaterThan(0);
    });
  });
});
