import { expect } from "chai";
import fs from "fs";
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SquadsMpl } from "../idl/squads_mpl";
import { ProgramManager } from "../idl/program_manager";
import { Roles } from "../idl/roles";

import {
  createBlankTransaction,
  createTestTransferTransaction,
} from "../helpers/transactions";
import { execSync } from "child_process";
import { LAMPORTS_PER_SOL, ParsedAccountData, SystemProgram } from "@solana/web3.js";
import Squads, {
  getMsPDA,
  getIxPDA,
  getProgramManagerPDA,
  getAuthorityPDA,
  getTxPDA,
} from "../sdk/src/index";
import BN from "bn.js";
import { getExecuteProxyInstruction, getUserRolePDA, getUserDelegatePDA, getRolesManager } from "../helpers/roles";
import { agnosticExecute } from "../helpers/sdkExecute";

import {memberListApprove} from "../helpers/approve";

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

const deployRoles = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/roles-keypair.json $(pwd)/target/deploy/roles.so`;
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

const getIxAuthority = async (txPda: anchor.web3.PublicKey, index: anchor.BN, programId: anchor.web3.PublicKey) => {
  return anchor.web3.PublicKey.findProgramAddress([
      anchor.utils.bytes.utf8.encode("squad"),
      txPda.toBuffer(),
      index.toArrayLike(Buffer, "le", 4),
      anchor.utils.bytes.utf8.encode("ix_authority")],
      programId
  );
};

let provider;

describe("Programs", function(){

  this.beforeAll(function(){
    // Configure the client to use the local cluster.
    provider = anchor.AnchorProvider.env();
    anchor.setProvider(provider);
  });

  describe("SMPL, Program Manager, & Roles", function(){

    let program;
    let squads;
    let creator;
    let programManagerProgram;
    let randomCreateKey;
    let msPDA;
    let pmPDA;
    let member2;
    let rolesProgram;

    const numberOfMembersTotal = 10;
    const memberList = [...new Array(numberOfMembersTotal - 1)].map(() => {
      return anchor.web3.Keypair.generate();
    });

    let threshold = 1;

    // test suite
    describe("SMPL Basic functionality", function(){
      this.beforeAll(async function(){
        console.log("Deploying SMPL Program...");
        deploySmpl();
        console.log("✔ SMPL Program deployed.");

        program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
        squads = Squads.localnet(provider.wallet, {
          commitmentOrConfig: "processed",
          multisigProgramId: anchor.workspace.SquadsMpl.programId,
          programManagerProgramId: anchor.workspace.ProgramManager.programId,
        });
        // the program-manager program / provider
        programManagerProgram = anchor.workspace
          .ProgramManager as Program<ProgramManager>;
      
        creator = (program.provider as anchor.AnchorProvider).wallet;
  
        // the Multisig PDA to use for the test run
        randomCreateKey = anchor.web3.Keypair.generate().publicKey;
        [msPDA] = getMsPDA(randomCreateKey, squads.multisigProgramId);
        [pmPDA] = getProgramManagerPDA(msPDA, squads.programManagerProgramId);
      
        member2 = anchor.web3.Keypair.generate();
      });

      it(`Create Multisig`, async function(){
        try {
          await squads.createMultisig(
            threshold,
            randomCreateKey,
            memberList.map((m) => m.publicKey)
          );
        }catch(e){
          console.log("Error in createMultisig tx");
          throw e;
        }
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
        try {
          await provider.sendAndConfirm(fundingTx);
        } catch (e) {
          console.log("Error in funding tx");
          throw e;
        }
        let msState = await squads.getMultisig(msPDA);
        expect(msState.threshold).to.equal(1);
        expect(msState.transactionIndex).to.equal(0);
        expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal);

        const vaultAccount = await squads.connection.getParsedAccountInfo(
          vaultPDA,
          "processed"
        );
        expect(vaultAccount.value.lamports).to.equal(0.001 * 1000000000);
      });

      it(`Create Tx draft`,  async function(){
        // create a transaction draft
        const txState = await squads.createTransaction(msPDA, 1);
        expect(txState.instructionIndex).to.equal(0);
        expect(txState.creator.toBase58()).to.equal(creator.publicKey.toBase58());

        // check the transaction indexes match
        const msState = await squads.getMultisig(msPDA);
        expect(txState.transactionIndex).to.equal(msState.transactionIndex);
      });

      it(`Add Ix to Tx`,  async function(){
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

      it(`Tx Activate`,  async function(){
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

      it(`Tx Sign`,  async function(){
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

      it(`Transfer Tx Execute`,  async function(){
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

      it(`2X Transfer Tx Execute`, async function() {
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

      it(`2X Transfer Tx Sequential execute`, async function(){
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

        expect(txState.executedIndex).to.equal(1);

        await squads.executeInstruction(txState.publicKey, ix2State.publicKey);

        ix2State = await squads.getInstruction(ix2State.publicKey);
        txState = await squads.getTransaction(txState.publicKey);

        expect(txState.executedIndex).to.equal(2);
        expect(txState.status).to.have.property("executed");
      });

      it(`Change ms size with realloc`, async function(){
        let msAccount = await squads.connection.getParsedAccountInfo(msPDA);
        let msStateCheck = await squads.getMultisig(msPDA, "confirmed");
        const startKeys = msStateCheck.keys.length;
        const startRentLamports = msAccount.value.lamports;
        // get the current data size of the msAccount
        const currDataSize = msAccount.value.data.length;
        // get the current number of keys
        const currNumKeys = msStateCheck.keys.length;
        // get the number of spots left
        const SIZE_WITHOUT_MEMBERS = 8 + // Anchor disriminator
        2 +         // threshold value
        2 +         // authority index
        4 +         // transaction index
        4 +         // processed internal transaction index
        1 +         // PDA bump
        32 +        // creator
        1 +         // allow external execute
        4;          // for vec length

        const spotsLeft = ((currDataSize - SIZE_WITHOUT_MEMBERS) / 32) - currNumKeys;

        // if there is less than 1 spot left, calculate rent needed for realloc of 10 more keys
        if(spotsLeft < 1){
          console.log("            MS needs more space")
          // add space for 10 more keys
          const neededLen = currDataSize + (10 * 32);
          // rent exempt lamports
          const rentExemptLamports = await squads.connection.getMinimumBalanceForRentExemption(neededLen);
          // top up lamports
          const topUpLamports = rentExemptLamports - msAccount.value.lamports;
          if(topUpLamports > 0){
            console.log("            MS needs more lamports, topping up ", topUpLamports);
            const topUpTx = await createBlankTransaction(squads.connection, creator.publicKey);
            const topUpIx = await createTestTransferTransaction(creator.publicKey, msPDA, topUpLamports);
            topUpTx.add(topUpIx);
            await provider.sendAndConfirm(topUpTx, undefined, {commitment: "confirmed"});
          }
        }
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

        try {
          await provider.sendAndConfirm(addMemberTx, undefined, {commitment: "confirmed"});
        } catch (e) {
          console.log("Error creating addMember transaction", e);
          throw e;
        }
        let txState = await squads.getTransaction(txPDA);
        try {
          await squads.approveTransaction(txPDA);
        }catch(e){
          console.log("error approving transaction", e);
          throw e;
        }

        txState = await squads.getTransaction(txPDA);
        expect(txState.status).has.property("executeReady");

        await squads.executeTransaction(txPDA);

        const msState = await squads.getMultisig(msPDA);
        msAccount = await program.provider.connection.getParsedAccountInfo(msPDA);
        const endRentLamports = msAccount.value.lamports;
        expect((msState.keys as any[]).length).to.equal(startKeys + 1);
        txState = await squads.getTransaction(txPDA);
        expect(txState.status).has.property("executed");
        expect(endRentLamports).to.be.greaterThan(startRentLamports);
      });

      // somewhat deprecated now as signAndSend falls back to wallet - needs to
      // be refactored to use a pure raw tx
      it(`Add a new member but creator is not executor`, async function(){
        // 1 get the instruction to create a transaction
        // 2 get the instruction to add a member
        // 3 get the instruction to 'activate' the tx
        // 4 send over the transaction to the ms program with 1 - 3
        // use 0 as authority index
        const newMember = anchor.web3.Keypair.generate().publicKey;
        const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
        let msState = await squads.getMultisig(msPDA);
        const startKeys = msState.keys.length;
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
        try {
          await provider.sendAndConfirm(addMemberTx, undefined, {commitment: "confirmed"});
        } catch (e) {
          console.log("unable to send add member tx");
          throw e;
        }
        let txState = await squads.getTransaction(txPDA);
        try {
          await squads.approveTransaction(txPDA);
        } catch (e) {
          console.log("unable to approve add member tx");
          throw e;
        }
        txState = await squads.getTransaction(txPDA);
        expect(txState.status).has.property("executeReady");
        await agnosticExecute(squads, txPDA, member2);

        txState = await squads.getTransaction(txPDA, "processed");
        expect(txState.status).has.property("executed");
        msState = await squads.getMultisig(msPDA, "confirmed");

        expect((msState.keys as any[]).length).to.equal(startKeys + 1);
      });

      it(`Transaction instruction failure`, async function(){
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

      it(`Change threshold test`, async function(){
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

      it(`Insufficient approval failure`, async function(){
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

      it(`Change vote from approved to rejected`, async function(){
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

      it(`Add a new member & change threshold (conjoined)`, async function(){
        const newMember = anchor.web3.Keypair.generate().publicKey;
        const txBuilder = await squads.getTransactionBuilder(msPDA, 0);
        let msState =  await squads.getMultisig(msPDA);
        const startKeys = msState.keys.length;
        const startTxIndex = msState.transactionIndex;
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
        try {
          await provider.sendAndConfirm(addMemberTx), undefined, {commitment: "confirmed"};
        } catch (e) {
          console.log("Failed to send add member tx");
          throw e;
        }
        msState = await squads.getMultisig(msPDA);
        expect(startTxIndex + 1).to.equal(msState.transactionIndex);
        // get necessary signers
        // if the threshold has changed, use the other members to approve as well
        for (let i = 0; i < memberList.length; i++) {
          // check to see if we need more signers
          const approvalState = await squads.getTransaction(txPDA);
          if (Object.keys(approvalState.status).indexOf("active") < 0) {
            break;
          }

          const inMultisig = (msState.keys as anchor.web3.PublicKey[]).findIndex(
            (k) => {
              return k.toBase58() == memberList[i].publicKey.toBase58();
            }
          );
          if (inMultisig < 0) {
            continue;
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
            } catch (e) {
              console.log(memberList[i].publicKey.toBase58(), " signing error");
            }
          } catch (e) {
            console.log(e);
          }
        }

        let txState = await squads.getTransaction(txPDA);
        expect(txState.status).has.property("executeReady");

        const payer = memberList[4];
        await provider.connection.requestAirdrop(
          payer.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        );

        await agnosticExecute(squads, txPDA, payer);

        txState = await squads.getTransaction(txPDA);
        expect(txState.status).has.property("executed");
        msState = await squads.getMultisig(msPDA);
        threshold = msState.threshold;
        expect((msState.keys as any[]).length).to.equal(startKeys + 1);
        expect(msState.threshold).to.equal(1);
      });
    });

    describe.skip("Program upgrades", function (){
      this.beforeAll(async function(){
        console.log('Deploying Program Manager Program');
        deployPm();
        console.log("✔ Program Manager Program deployed.");
      });

      it(`Create a program manager`,  async function(){
        const newProgramManager = await squads.createProgramManager(msPDA);
        expect(newProgramManager.multisig.toBase58()).to.equal(msPDA.toBase58());
      });

      it(`Create a program to manage`, async function(){
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
      it(`Create a program to manage and create upgrade`, async function(){
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

      it(`Create upgrade with buffer and deploy it`,  async function(){
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
            break;
          }

          const inMultisig = (msState.keys as anchor.web3.PublicKey[]).findIndex(
            (k) => {
              return k.toBase58() == memberList[i].publicKey.toBase58();
            }
          );
          if (inMultisig < 0) {
            continue;
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
            } catch (e) {
              console.log(memberList[i].publicKey.toBase58(), " signing error");
            }
          } catch (e) {
            console.log(e);
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
  
    // test suite for the roles program
    describe.skip("Roles Program", async function(){
      const userWithInitRole = anchor.web3.Keypair.generate();
      const userWithVoteRole = anchor.web3.Keypair.generate();
      const userWithExecuteRole = anchor.web3.Keypair.generate();
      let rolesManager;

      let userWithInitRolePDA;
      let userWithInitRoleDelegatePDA;
      let userWithVoteRolePDA;
      let userWithVoteRoleDelegatePDA;
      let userWithExecuteRolePDA;
      let userWithExecuteRoleDelegatePDA;

      this.beforeAll(async function(){
        console.log("Deploying Roles Program...");
        deployRoles();
        console.log("✔ Roles Program deployed.");

        rolesProgram = anchor.workspace.Roles as Program<Roles>;
        [rolesManager] = await getRolesManager(msPDA, rolesProgram.programId);

        // initiate only role
        [userWithInitRolePDA] = await getUserRolePDA(msPDA, new anchor.BN(1), rolesProgram.programId);
        [userWithInitRoleDelegatePDA] = await getUserDelegatePDA(userWithInitRolePDA, userWithInitRole.publicKey, rolesProgram.programId);

        // vote only role
        [userWithVoteRolePDA] = await getUserRolePDA(msPDA, new anchor.BN(2), rolesProgram.programId);
        [userWithVoteRoleDelegatePDA] = await getUserDelegatePDA(userWithVoteRolePDA, userWithVoteRole.publicKey, rolesProgram.programId);

        // execute only role
        [userWithExecuteRolePDA] = await getUserRolePDA(msPDA, new anchor.BN(3), rolesProgram.programId);
        [userWithExecuteRoleDelegatePDA] = await getUserDelegatePDA(userWithExecuteRolePDA, userWithExecuteRole.publicKey, rolesProgram.programId);
      });

      it("Create Roles Manager", async function(){
        try {
          await rolesProgram.methods.createManager()
            .accounts({
              rolesManager,
              multisig: msPDA,
            }).rpc();
        }catch(e){
          console.log(e);
        }
        let rmState = await rolesProgram.account.rolesManager.fetch(rolesManager);
        expect(rmState.ms.toBase58()).to.equal(msPDA.toBase58());
      });

      it("Add new member roles and add them to the MS", async function(){

        // default authority to use for signing
        const [defaultAuthority] = await getAuthorityPDA(msPDA, new BN(1), program.programId);
        
        //
        // create role tx -- needs to be executed by all members
        let msState = await program.account.ms.fetch(msPDA);
        let nextTxIndex = msState.transactionIndex + 1;
        // generate the txPDA
        let [txPDA] = await getTxPDA(
          msPDA,
          new BN(nextTxIndex, 10),
          program.programId
        );

        // the transaction to add the delegate to the MS
        try {
          await program.methods.createTransaction(1)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              creator: provider.wallet.publicKey,
            })
            .rpc();
        } catch (e) {
          console.log("failed to create the authority 0 tx", e);
        }

        // the ix that will create the user init role
        const createInitRoleIx = await rolesProgram.methods.addUser(userWithInitRole.publicKey, {initiate:{}}, "Initiate Only")
            .accounts({
              user: userWithInitRolePDA,
              multisig: msPDA,
              payer: provider.wallet.publicKey,
              transaction: txPDA,
              authority: defaultAuthority,
              rolesManager,
            }).instruction();
        
        const createVoteRoleIx = await rolesProgram.methods.addUser(userWithVoteRole.publicKey, {vote:{}}, "Vote only")
            .accounts({
              user: userWithVoteRolePDA,
              multisig: msPDA,
              payer: provider.wallet.publicKey,
              transaction: txPDA,
              authority: defaultAuthority,
              rolesManager,
            }).instruction();

        const createExecuteRoleIx = await rolesProgram.methods.addUser(userWithExecuteRole.publicKey, {execute:{}}, "Execute only")
            .accounts({
              user: userWithExecuteRolePDA,
              multisig: msPDA,
              payer: provider.wallet.publicKey,
              transaction: txPDA,
              authority: defaultAuthority,
              rolesManager
            }).instruction();

        // generate the ixPDAs
        let [ixPDA_1] = await getIxPDA(
          txPDA,
          new BN(1, 10),
          program.programId
        );

        let [ixPDA_2] = await getIxPDA(
          txPDA,
          new BN(2, 10),
          program.programId
        );

        let [ixPDA_3] = await getIxPDA(
          txPDA,
          new BN(3, 10),
          program.programId
        );

        // attach the role create Ixs
        await program.methods.addInstruction(createInitRoleIx)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              instruction: ixPDA_1,
              creator: provider.wallet.publicKey
            })
            .rpc();

        await program.methods.addInstruction(createVoteRoleIx)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              instruction: ixPDA_2,
              creator: provider.wallet.publicKey
            })
            .rpc();  

        await program.methods.addInstruction(createExecuteRoleIx)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              instruction: ixPDA_3,
              creator: provider.wallet.publicKey
            })
            .rpc();  

        // activate it
        try {
          // the activation ix
          await program.methods.activateTransaction()
          .accounts({
              multisig: msPDA,
              transaction: txPDA,
              creator: provider.wallet.publicKey
            })
            .rpc();
        }catch(e){
          console.log("failed to activate the tx", e);
        }

        // approve it
        await memberListApprove(memberList, msPDA, txPDA, squads, provider, program);
        let txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("executeReady");

        try {
          await squads.executeTransaction(txPDA);
        }catch(e){
          console.log("failed to execute the tx", e);
        }

        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("executed");


        // //
        // // the transaction to add the 3 delegates to the MS
        msState = await program.account.ms.fetch(msPDA);
        nextTxIndex = msState.transactionIndex + 1;
        // generate the txPDA
        [txPDA] = await getTxPDA(
          msPDA,
          new BN(nextTxIndex, 10),
          program.programId
        );
        try {
          await program.methods.createTransaction(0)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              creator: provider.wallet.publicKey,
            })
            .rpc();
        } catch (e) {
          console.log("failed to create the authority 0 tx", e);
        }
        
        [ixPDA_1] = await getIxPDA(txPDA,new BN(1, 10),program.programId);
        [ixPDA_2] = await getIxPDA(txPDA,new BN(2, 10),program.programId);
        [ixPDA_3] = await getIxPDA(txPDA,new BN(3, 10),program.programId);
        
        const addMemberIx1 = await program.methods.addMember(userWithInitRoleDelegatePDA)
            .accounts({
              multisig: msPDA,
              multisigAuth: msPDA,
              member: provider.wallet.publicKey,
            })
            .instruction();

        const addMemberIx2 = await program.methods.addMember(userWithVoteRoleDelegatePDA)
            .accounts({
              multisig: msPDA,
              multisigAuth: msPDA,
              member: provider.wallet.publicKey,
            })
            .instruction();

        const addMemberIx3 = await program.methods.addMember(userWithExecuteRoleDelegatePDA)
            .accounts({
              multisig: msPDA,
              multisigAuth: msPDA,
              member: provider.wallet.publicKey,
            })
            .instruction();

        await program.methods.addInstruction(addMemberIx1)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              instruction: ixPDA_1,
              creator: provider.wallet.publicKey
            })
            .rpc();

        await program.methods.addInstruction(addMemberIx2)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              instruction: ixPDA_2,
              creator: provider.wallet.publicKey
            })
            .rpc();

        await program.methods.addInstruction(addMemberIx3)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              instruction: ixPDA_3,
              creator: provider.wallet.publicKey
            })
            .rpc();

        try {
          // the activation ix
          await program.methods.activateTransaction()
          .accounts({
              multisig: msPDA,
              transaction: txPDA,
              creator: provider.wallet.publicKey
            })
            .rpc();
        }catch(e){
          console.log("failed to activate the tx", e);
        }

        // approve the tx
        await memberListApprove(memberList, msPDA, txPDA, squads, provider, program);
        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("executeReady");
        const keysBefore = msState.keys.length;
        try {
          await squads.executeTransaction(txPDA);
        }catch(e){
          console.log("failed to execute the tx", e);
        }
        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("executed");
        msState = await program.account.ms.fetch(msPDA);

        let roleState = await rolesProgram.account.user.fetch(userWithInitRolePDA);
        expect(roleState.originKey.toBase58()).to.equal(userWithInitRole.publicKey.toBase58());

        roleState = await rolesProgram.account.user.fetch(userWithVoteRolePDA);
        expect(roleState.originKey.toBase58()).to.equal(userWithVoteRole.publicKey.toBase58());

        roleState = await rolesProgram.account.user.fetch(userWithExecuteRolePDA);
        expect(roleState.originKey.toBase58()).to.equal(userWithExecuteRole.publicKey.toBase58());

        expect(msState.keys.length).to.equal(keysBefore + 3);
      });

      it("New user role initiate withdrawal & vote role", async function(){
        const [vault] = await getAuthorityPDA(msPDA, new anchor.BN(1), program.programId);

        await provider.connection.requestAirdrop(
          userWithInitRole.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.requestAirdrop(
          userWithVoteRole.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.requestAirdrop(
          userWithExecuteRole.publicKey,
          anchor.web3.LAMPORTS_PER_SOL
        );
        await provider.connection.requestAirdrop(
          vault,
          anchor.web3.LAMPORTS_PER_SOL
        );

        let msState = await program.account.ms.fetch(msPDA);
        const nextTxIndex = msState.transactionIndex + 1;
        // generate the txPDA
        const [txPDA] = await getTxPDA(
          msPDA,
          new BN(nextTxIndex, 10),
          program.programId
        );
        // create/initiate a squads transaction
        try {
          const createProxyTx = await rolesProgram.methods.createProxy(1)
            .accounts({
              multisig: msPDA,
              transaction: txPDA,
              user: userWithInitRolePDA,
              delegate: userWithInitRoleDelegatePDA,
              creator: userWithInitRole.publicKey,
              squadsProgram: program.programId
            })
            .signers([userWithInitRole.publicKey])
            .transaction();
          
            await provider.sendAndConfirm(createProxyTx, [userWithInitRole], {skipPreflight: true});
        }catch(e){
          console.log(e);
          console.log("failed to create the user 1 tx", e);
        }
        let txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("draft");
        // attach an instruction
        const [ixPDA] = await getIxPDA(txPDA, new anchor.BN(1), program.programId);
        const withdrawIx = await SystemProgram.transfer({fromPubkey: vault, toPubkey: provider.wallet.publicKey, lamports: LAMPORTS_PER_SOL/2});
        const addWithdrawIxTx = await rolesProgram.methods.addProxy(withdrawIx)
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            instruction: ixPDA,
            user: userWithInitRolePDA,
            delegate: userWithInitRoleDelegatePDA,
            creator: userWithInitRole.publicKey,
            squadsProgram: program.programId
          })
          .transaction();
          
          try {
            await provider.sendAndConfirm(addWithdrawIxTx, [userWithInitRole], {skipPreflight: true});
          }catch(e){
            console.log(e);
          }
          txState = await program.account.msTransaction.fetch(txPDA);
          expect(txState.instructionIndex).to.equal(1);

        // activate the instruction
        const activateIxTx = await rolesProgram.methods.activateProxy()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            user: userWithInitRolePDA,
            delegate: userWithInitRoleDelegatePDA,
            creator: userWithInitRole.publicKey,
            squadsProgram: program.programId
          }).transaction();
        try {
          await provider.sendAndConfirm(activateIxTx, [userWithInitRole], {skipPreflight: true});
        }catch(e){
          console.log(e);
        }
        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("active");

        // // now fail when voting
        const approveIxTx = await rolesProgram.methods.approveProxy()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            user: userWithInitRolePDA,
            delegate: userWithInitRoleDelegatePDA,
            member: userWithInitRole.publicKey,
            squadsProgram: program.programId
          }).transaction();

        try {
          await provider.sendAndConfirm(approveIxTx, [userWithInitRole], {skipPreflight: true});
          expect(true).to.equal(false);
        }catch(e){
          // we should hit this
          expect(true).to.equal(true);
        }
        expect(txState.status).to.have.property("active");

        // // now succeed when voting
          const approveIxTxWithVoteRole = await rolesProgram.methods.approveProxy()
          .accounts({
            multisig: msPDA,
            transaction: txPDA,
            user: userWithVoteRolePDA,
            delegate: userWithVoteRoleDelegatePDA,
            member: userWithVoteRole.publicKey,
            squadsProgram: program.programId
          }).transaction();

        try {
          await provider.sendAndConfirm(approveIxTxWithVoteRole, [userWithVoteRole], {skipPreflight: true});
        }catch(e){
          // we should hit this
          expect(true).to.equal(false);
        }
        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.approved.length).to.equal(1);
        expect(txState.approved[0].toBase58()).to.equal(userWithVoteRoleDelegatePDA.toBase58());

        // sign to approve with the other members
        await memberListApprove(memberList, msPDA, txPDA, squads, provider, program);

        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("executeReady");

        // test execute role
        // get the proxied execute ix
        const executeIx = await getExecuteProxyInstruction(
          txPDA,
          userWithExecuteRole.publicKey,
          userWithExecuteRolePDA,
          userWithExecuteRoleDelegatePDA,
          program,
          rolesProgram
        );

        const executeTx = new anchor.web3.Transaction();
        executeTx.add(executeIx);
        try {
          await provider.sendAndConfirm(executeTx, [userWithExecuteRole]);
        }catch(e){
          console.log(e);
          expect(true).to.equal(false);
        }
        txState = await program.account.msTransaction.fetch(txPDA);
        expect(txState.status).to.have.property("executed");
      });
    });

  });

});
