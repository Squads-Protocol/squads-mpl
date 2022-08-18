import { expect } from "chai";
import fs from "fs";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SquadsMpl } from "../target/types/squads_mpl";
import { ProgramManager } from "../target/types/program_manager";
import {
  createBlankTransaction,
  createTestTransferTransaction,
} from "../helpers/transactions";
import { execSync } from "child_process";
import { ParsedAccountData } from "@solana/web3.js";
import Squads, {
  getMsPDA,
  getIxPDA,
  getProgramManagerPDA,
  getAuthorityPDA,
} from "@sqds/sdk";
import BN from "bn.js";

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
      await squads.createMultisig(
        threshold,
        randomCreateKey,
        memberList.map((m) => m.publicKey)
      );
      const vaultPDA = squads.getAuthorityPDA(msPDA, 1);

      const fundingTx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      const fundingIx = await createTestTransferTransaction(
        creator.publicKey,
        vaultPDA,
        0.001 * 1000000000
      );

      fundingTx.add(fundingIx);
      await provider.sendAndConfirm(fundingTx);

      let msState = await squads.getMultisig(msPDA);
      expect(msState.threshold).to.equal(1);
      expect(msState.transactionIndex).to.equal(0);
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal);

      const vaultAccount = await squads.connection.getParsedAccountInfo(
        vaultPDA
      );
      expect(vaultAccount.value.lamports).to.equal(0.001 * 1000000000);
    });

    it(`Create Tx draft - MS: ${msPDA.toBase58()}`, async () => {
      // create a transaction draft
      const txState = await squads.createTransaction(msPDA, 1);
      expect(txState.instructionIndex).to.equal(0);
      expect(txState.creator.toBase58()).to.equal(creator.publicKey.toBase58());

      // check the transaction indexes match
      const msState = await squads.getMultisig(msPDA);
      expect(txState.transactionIndex).to.equal(msState.transactionIndex);
    });

    it(`Add Ix to Tx - MS: ${msPDA.toBase58()}`, async () => {
      // create a transaction draft
      let txState = await squads.createTransaction(msPDA, 1);
      // check the transaction indexes match
      expect(txState.instructionIndex).to.equal(0);
      expect(txState.status).to.have.property("draft");

      const testIx = await createTestTransferTransaction(
        msPDA,
        creator.publicKey
      );
      const ixState = await squads.addInstruction(txState.publicKey, testIx);
      txState = await squads.getTransaction(txState.publicKey);
      expect(ixState.instructionIndex).to.equal(1);
      expect(txState.instructionIndex).to.equal(1);
    });

    it(`Tx Activate - MS: ${msPDA.toBase58()}`, async () => {
      // create a transaction draft
      let txState = await squads.createTransaction(msPDA, 1);
      const testIx = await createTestTransferTransaction(
        msPDA,
        creator.publicKey
      );
      let ixState = await squads.addInstruction(txState.publicKey, testIx);
      await squads.activateTransaction(txState.publicKey);

      txState = await squads.getTransaction(txState.publicKey);
      expect(txState.status).to.have.property("active");
      ixState = await squads.getInstruction(ixState.publicKey);
      expect(ixState.programId.toBase58()).to.equal(
        testIx.programId.toBase58()
      );
    });

    it(`Tx Sign - MS: ${msPDA.toBase58()}`, async () => {
      // create a transaction draft
      let txState = await squads.createTransaction(msPDA, 1);
      const testIx = await createTestTransferTransaction(
        msPDA,
        creator.publicKey
      );
      await squads.addInstruction(txState.publicKey, testIx);
      await squads.activateTransaction(txState.publicKey);
      await squads.approveTransaction(txState.publicKey);

      txState = await squads.getTransaction(txState.publicKey);
      expect(txState.approved.length).to.equal(1);
      expect(txState.status).to.have.property("executeReady");
    });

    it(`Transfer Tx Execute - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityPDA = squads.getAuthorityPDA(msPDA, 1);

      // the test transfer instruction
      const testPayee = anchor.web3.Keypair.generate();
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );

      let txState = await squads.createTransaction(msPDA, 1);
      await squads.addInstruction(txState.publicKey, testIx);
      await squads.activateTransaction(txState.publicKey);
      await squads.approveTransaction(txState.publicKey);

      txState = await squads.getTransaction(txState.publicKey);
      expect(txState.status).to.have.property("executeReady");

      // move funds to auth/vault
      const moveFundsToMsPDATx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      const moveFundsToMsPDAIx = await createTestTransferTransaction(
        creator.publicKey,
        authorityPDA
      );
      moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
      await provider.sendAndConfirm(moveFundsToMsPDATx);
      const authorityPDAFunded = await squads.connection.getAccountInfo(
        authorityPDA
      );
      expect(authorityPDAFunded.lamports).to.equal(2000000);

      await squads.executeTransaction(txState.publicKey);

      txState = await squads.getTransaction(txState.publicKey);

      expect(txState.status).to.have.property("executed");
      const testPayeeAccount = await squads.connection.getParsedAccountInfo(
        testPayee.publicKey
      );
      expect(testPayeeAccount.value.lamports).to.equal(1000000);
    });

    it(`2X Transfer Tx Execute - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityPDA = squads.getAuthorityPDA(msPDA, 1);

      // the test transfer instruction (2x)
      const testPayee = anchor.web3.Keypair.generate();
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );
      const testIx2x = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );

      let txState = await squads.createTransaction(msPDA, 1);
      await squads.addInstruction(txState.publicKey, testIx);
      await squads.addInstruction(txState.publicKey, testIx2x);
      await squads.activateTransaction(txState.publicKey);
      await squads.approveTransaction(txState.publicKey);

      // move funds to auth/vault
      const moveFundsToMsPDAIx = await createTestTransferTransaction(
        creator.publicKey,
        authorityPDA,
        3000000
      );

      const moveFundsToMsPDATx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
      await provider.sendAndConfirm(moveFundsToMsPDATx);
      const msPDAFunded = await squads.connection.getAccountInfo(authorityPDA);
      expect(msPDAFunded.lamports).to.equal(4000000);

      await squads.executeTransaction(txState.publicKey);

      txState = await squads.getTransaction(txState.publicKey);
      expect(txState.status).to.have.property("executed");
      let testPayeeAccount = await squads.connection.getParsedAccountInfo(
        testPayee.publicKey
      );
      expect(testPayeeAccount.value.lamports).to.equal(2000000);
    });

    it(`2X Transfer Tx Sequential execute - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityPDA = squads.getAuthorityPDA(msPDA, 1);

      let txState = await squads.createTransaction(msPDA, 1);

      // person/entity who gets paid
      const testPayee = anchor.web3.Keypair.generate();

      ////////////////////////////////////////////////////////
      // add the first transfer

      // the test transfer instruction
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );

      let ixState = await squads.addInstruction(txState.publicKey, testIx);

      //////////////////////////////////////////////////////////
      // add the second transfer ix

      const testIx2x = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey
      );
      let ix2State = await squads.addInstruction(txState.publicKey, testIx2x);
      await squads.activateTransaction(txState.publicKey);
      await squads.approveTransaction(txState.publicKey);

      // move funds to auth/vault
      const moveFundsToMsPDAIx = await createTestTransferTransaction(
        creator.publicKey,
        authorityPDA,
        3000000
      );
      const moveFundsToMsPDATx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      moveFundsToMsPDATx.add(moveFundsToMsPDAIx);
      await provider.sendAndConfirm(moveFundsToMsPDATx);
      const msPDAFunded = await squads.connection.getAccountInfo(authorityPDA);
      // expect the vault to be correct:
      expect(msPDAFunded.lamports).to.equal(5000000);
      // lead with the expected program account, follow with the other accounts for the ix
      await squads.executeInstruction(txState.publicKey, ixState.publicKey);
      ixState = await squads.getInstruction(ixState.publicKey);
      txState = await squads.getTransaction(txState.publicKey);

      expect(ixState.executed).to.be.true;
      expect(txState.executedIndex).to.equal(1);

      await squads.executeInstruction(txState.publicKey, ix2State.publicKey);

      ix2State = await squads.getInstruction(ix2State.publicKey);
      txState = await squads.getTransaction(txState.publicKey);

      expect(ix2State.executed).to.be.true;
      expect(txState.executedIndex).to.equal(2);
      expect(txState.status).to.have.property("executed");
    });

    it(`Change ms size with realloc - MS: ${msPDA.toBase58()}`, async () => {
      let msAccount = await squads.connection.getParsedAccountInfo(msPDA);
      const startRentLamports = msAccount.value.lamports;

      // 1 get the instruction to create a transction
      // 2 get the instruction to add a member
      // 3 get the instruction to 'activate' the tx
      // 4 send over the transaction to the ms program with 1 - 3
      // use 0 as authority index
      const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
      const [txInstructions, txPDA] = await (
        await txBuilder.withAddMember(member2.publicKey)
      ).getInstructions();
      const activateIx = await squads.buildActivateTransaction(msPDA, txPDA);

      let addMemberTx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      addMemberTx.add(...txInstructions);
      addMemberTx.add(activateIx);

      await provider.sendAndConfirm(addMemberTx);

      await squads.approveTransaction(txPDA);

      let txState = await squads.getTransaction(txPDA);
      expect(txState.status).has.property("executeReady");

      await squads.executeTransaction(txPDA);

      const msState = await squads.getMultisig(msPDA);
      msAccount = await program.provider.connection.getParsedAccountInfo(msPDA);
      const endRentLamports = msAccount.value.lamports;
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 1);
      expect(endRentLamports).to.be.greaterThan(startRentLamports);
    });

    it(`Add a new member but creator is not executor - MS: ${msPDA.toBase58()}`, async () => {
      // 1 get the instruction to create a transaction
      // 2 get the instruction to add a member
      // 3 get the instruction to 'activate' the tx
      // 4 send over the transaction to the ms program with 1 - 3
      // use 0 as authority index
      const newMember = anchor.web3.Keypair.generate().publicKey;
      const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
      const [txInstructions, txPDA] = await (
        await txBuilder.withAddMember(newMember)
      ).getInstructions();
      const activateIx = await squads.buildActivateTransaction(msPDA, txPDA);

      let addMemberTx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      addMemberTx.add(...txInstructions);
      addMemberTx.add(activateIx);

      await provider.sendAndConfirm(addMemberTx);

      await squads.approveTransaction(txPDA);

      let txState = await squads.getTransaction(txPDA);
      expect(txState.status).has.property("executeReady");

      await squads.executeTransaction(txPDA);

      const msState = await squads.getMultisig(msPDA);
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 2);
    });

    it(`Transaction instruction failure - MS: ${msPDA.toBase58()}`, async () => {
      // create authority to use (Vault, index 1)
      const authorityPDA = squads.getAuthorityPDA(msPDA, 1);
      let txState = await squads.createTransaction(msPDA, 1);

      // the test transfer instruction
      const testPayee = anchor.web3.Keypair.generate();
      const testIx = await createTestTransferTransaction(
        authorityPDA,
        testPayee.publicKey,
        anchor.web3.LAMPORTS_PER_SOL * 100
      );

      // add the instruction to the transaction
      await squads.addInstruction(txState.publicKey, testIx);
      await squads.activateTransaction(txState.publicKey);
      await squads.approveTransaction(txState.publicKey);

      try {
        await squads.executeTransaction(txState.publicKey);
      } catch (e) {
        // :(
        expect(e.message).to.include("failed");
      }

      txState = await squads.getTransaction(txState.publicKey);
      expect(txState.status).to.have.property("executeReady");
    });

    it(`Change threshold test - MS: ${msPDA.toBase58()}`, async () => {
      const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
      const [txInstructions, txPDA] = await (
        await txBuilder.withChangeThreshold(2)
      ).getInstructions();
      const emptyTx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      emptyTx.add(...txInstructions);
      await provider.sendAndConfirm(emptyTx);

      // get the ix
      let ixState = await squads.getInstruction(
        getIxPDA(txPDA, new BN(1, 10), squads.multisigProgramId)[0]
      );
      expect(ixState.instructionIndex).to.equal(1);

      // activate the tx
      let txState = await squads.activateTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await squads.approveTransaction(txPDA);

      // get the TX
      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("executeReady");

      // execute the tx
      txState = await squads.executeTransaction(txPDA);
      const msState = await squads.getMultisig(msPDA);

      expect(msState.threshold).to.equal(2);
      expect(txState.status).to.have.property("executed");
      threshold = msState.threshold;
    });

    it(`Insufficient approval failure - MS: ${msPDA.toBase58()}`, async () => {
      const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
      const [txInstructions, txPDA] = await (
        await txBuilder.withChangeThreshold(2)
      ).executeInstructions();

      // get the ix
      let ixState = await squads.getInstruction(
        getIxPDA(txPDA, new BN(1, 10), squads.multisigProgramId)[0]
      );
      expect(ixState.instructionIndex).to.equal(1);

      // activate the tx
      let txState = await squads.activateTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      await squads.approveTransaction(txPDA);

      // execute the tx
      try {
        await squads.executeTransaction(txPDA);
      } catch (e) {
        expect(e.message).to.contain("Error processing Instruction");
      }
    });

    it(`Change vote from approved to rejected - MS: ${msPDA.toBase58()}`, async () => {
      const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
      const [txInstructions, txPDA] = await (
        await txBuilder.withChangeThreshold(2)
      ).executeInstructions();

      // get the ix
      let ixState = await squads.getInstruction(
        getIxPDA(txPDA, new BN(1, 10), squads.multisigProgramId)[0]
      );
      expect(ixState.instructionIndex).to.equal(1);

      // activate the tx
      let txState = await squads.activateTransaction(txPDA);
      expect(txState.status).to.have.property("active");

      // approve the tx
      txState = await squads.approveTransaction(txPDA);

      // check that state is "approved"
      expect(txState.status).to.have.property("active");
      expect(
        txState.approved
          .map((k) => k.toBase58())
          .indexOf(creator.publicKey.toBase58())
      ).is.greaterThanOrEqual(0);

      // now reject
      txState = await squads.rejectTransaction(txPDA);
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

    it(`Add a new member & change threshold (conjoined) - MS: ${msPDA.toBase58()}`, async () => {
      const newMember = anchor.web3.Keypair.generate().publicKey;
      const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
      const [txInstructions, txPDA] = await (
        await txBuilder.withAddMemberAndChangeThreshold(newMember, 1)
      ).getInstructions();
      const activateIx = await squads.buildActivateTransaction(msPDA, txPDA);

      let addMemberTx = await createBlankTransaction(
        squads.connection,
        creator.publicKey
      );
      addMemberTx.add(...txInstructions);
      addMemberTx.add(activateIx);

      await provider.sendAndConfirm(addMemberTx);
      let msState = await squads.getMultisig(msPDA);
      // get necessary signers
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

      let txState = await squads.getTransaction(txPDA);
      expect(txState.status).has.property("executeReady");

      await squads.executeTransaction(txPDA);
      txState = await squads.getTransaction(txPDA);
      expect(txState.status).has.property("executed");
      msState = await squads.getMultisig(msPDA);
      threshold = msState.threshold;
      expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 3);
      expect(msState.threshold).to.equal(1);
    });
  });

  describe("Program upgrades", () => {
    it(`Create a program manager - MS: ${msPDA.toBase58()}`, async () => {
      const newProgramManager = await squads.createProgramManager(msPDA);
      expect(newProgramManager.multisig.toBase58()).to.equal(msPDA.toBase58());
    });

    it(`Create a program to manage - MS ${msPDA.toBase58()}`, async () => {
      const testProgramAddress = anchor.web3.Keypair.generate().publicKey;
      const nameString = "This is my test Program";
      const mpState = await squads.createManagedProgram(
        msPDA,
        testProgramAddress,
        nameString
      );
      expect(mpState.name).to.equal(nameString);
      expect(mpState.managedProgramIndex).to.equal(1);
    });
    it(`Create a program to manage and create upgrade - MS ${msPDA.toBase58()}`, async () => {
      const testProgramAddress = anchor.web3.Keypair.generate().publicKey;
      const nameString = "This is my test Program 2";
      let mpState = await squads.createManagedProgram(
        msPDA,
        testProgramAddress,
        nameString
      );
      expect(mpState.name).to.equal(nameString);
      expect(mpState.managedProgramIndex).to.equal(2);

      const testBufferAddress = anchor.web3.Keypair.generate().publicKey;
      const testSpillAddress = anchor.web3.Keypair.generate().publicKey;
      const testAuthorityAddress = anchor.web3.Keypair.generate().publicKey;
      const testUpgradeName = "Upgrade #1";

      const addedUpgrade = await squads.createProgramUpgrade(
        msPDA,
        mpState.publicKey,
        testBufferAddress,
        testSpillAddress,
        testAuthorityAddress,
        testUpgradeName
      );
      mpState = await squads.getManagedProgram(mpState.publicKey);
      expect(addedUpgrade.upgradeIndex).to.equal(mpState.upgradeIndex);
      expect(addedUpgrade.name).to.equal(testUpgradeName);
      expect(addedUpgrade.upgradeIx.programId.toBase58()).to.equal(
        BPF_UPGRADE_ID.toBase58()
      );
    });

    it(`Create upgrade with buffer and deploy it - MS ${msPDA.toBase58()}`, async function () {
      this.timeout(30000);
      const nextProgramIndex = await squads.getNextProgramIndex(
        getProgramManagerPDA(msPDA, squads.programManagerProgramId)[0]
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
      const parsedBufferAccount = await squads.connection.getParsedAccountInfo(
        bufferKeypair.publicKey
      );
      const parsedBufferData = (
        parsedBufferAccount.value.data as ParsedAccountData
      ).parsed;
      expect(parsedBufferData.type).to.equal("buffer");
      expect(parsedBufferData.info.authority).to.equal(vaultPDA.toBase58());

      // set the program authority
      setProgramAuthority(programManagerProgram.programId, vaultPDA);

      // add the program
      const nameString = "The program manager program, itself";
      const mpState = await squads.createManagedProgram(
        msPDA,
        programManagerProgram.programId,
        nameString
      );
      expect(mpState.name).to.equal(nameString);
      expect(mpState.managedProgramIndex).to.equal(nextProgramIndex);

      // create the upgrade

      const testUpgradeName = "Upgrade #1";
      const upgradeState = await squads.createProgramUpgrade(
        msPDA,
        mpState.publicKey,
        bufferKeypair.publicKey,
        squads.wallet.publicKey,
        vaultPDA,
        testUpgradeName
      );

      // verify the upgrade account was created, and that the buffers match as well in the ix
      const managedProgramState = await squads.getManagedProgram(
        mpState.publicKey
      );
      expect(upgradeState.upgradeIndex).to.equal(
        managedProgramState.upgradeIndex
      );
      expect(upgradeState.name).to.equal(testUpgradeName);
      // check the upgrade Ix accounts match
      expect(upgradeState.upgradeIx.programId.toBase58()).to.equal(
        BPF_UPGRADE_ID.toBase58()
      );
      expect(upgradeState.upgradeIx.accounts[1].pubkey.toBase58()).to.equal(
        programManagerProgram.programId.toBase58()
      );
      expect(upgradeState.upgradeIx.accounts[2].pubkey.toBase58()).to.equal(
        bufferKeypair.publicKey.toBase58()
      );
      expect(upgradeState.upgradeIx.accounts[3].pubkey.toBase58()).to.equal(
        provider.wallet.publicKey.toBase58()
      );
      expect(upgradeState.upgradeIx.accounts[6].pubkey.toBase58()).to.equal(
        vaultPDA.toBase58()
      );

      // create a new tx for the upgrade
      let txBuilder = await squads.getTransactionBuilder(msPDA, 1);
      // the upgrade instruction
      const upgradeIx = {
        programId: upgradeState.upgradeIx.programId,
        data: upgradeState.upgradeIx.upgradeInstructionData as Buffer,
        keys: upgradeState.upgradeIx.accounts as anchor.web3.AccountMeta[],
      };
      const [ixPDA] = getIxPDA(
        txBuilder.transactionPDA(),
        new BN(1, 10),
        squads.multisigProgramId
      );
      const [ix2PDA] = getIxPDA(
        txBuilder.transactionPDA(),
        new BN(2, 10),
        squads.multisigProgramId
      );
      txBuilder = await txBuilder
        .withInstruction(upgradeIx)
        .withSetAsExecuted(
          pmPDA,
          mpState.publicKey,
          upgradeState.publicKey,
          txBuilder.transactionPDA(),
          ixPDA,
          1
        );

      const [, txPDA] = await txBuilder.executeInstructions();

      // get the ix
      let ixState = await squads.getInstruction(ixPDA);
      expect(ixState.instructionIndex).to.equal(1);

      // get the ix 2
      let ix2State = await squads.getInstruction(ix2PDA);
      expect(ix2State.instructionIndex).to.equal(2);

      let txState = await squads.getTransaction(txPDA);
      expect(txState.instructionIndex).to.equal(2);

      // activate the tx
      await squads.activateTransaction(txPDA);

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
      expect(txState.status).to.have.property("executeReady");

      await squads.executeTransaction(txPDA);

      txState = await squads.getTransaction(txPDA);
      expect(txState.status).to.have.property("executed");
      const puState = await squads.getProgramUpgrade(upgradeState.publicKey);
      expect(puState.executed).to.be.true;
      expect(puState.upgradedOn.toNumber()).to.be.greaterThan(0);
    });
  });
});
