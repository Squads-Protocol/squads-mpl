import { expect } from "chai";
import fs from "fs";
import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { SquadsMpl } from "../idl/squads_mpl";
import { ProgramManager } from "../idl/program_manager";
import { Roles } from "../idl/roles";
import { Mesh } from "../idl/mesh";

import {
  createBlankTransaction,
  createTestTransferTransaction,
  executeTransaction,
} from "../helpers/transactions";
import { execSync } from "child_process";
import { LAMPORTS_PER_SOL, ParsedAccountData, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import Squads, {
  getMsPDA,
  getIxPDA,
  getProgramManagerPDA,
  getAuthorityPDA,
  getTxPDA,
} from "@sqds/sdk";
import BN from "bn.js";
import { TOKEN_PROGRAM_ID } from "@project-serum/anchor/dist/cjs/utils/token";
import { getExecuteProxyInstruction, getUserRolePDA, getUserDelegatePDA, getRolesManager } from "../helpers/roles";

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

const deployMesh = () => {
  const deployCmd = `solana program deploy --url localhost -v --program-id $(pwd)/target/deploy/mesh-keypair.json $(pwd)/target/deploy/mesh.so`;
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

    let program: Program<SquadsMpl>;
    let squads;
    let creator: anchor.AnchorProvider["wallet"];
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
    describe("SMPL Basic functionality", async function(){
      this.beforeAll(async function(){
        console.log("Deploying programs...");
        deploySmpl();
        console.log("✔ SMPL Program deployed.");
        deployPm();
        console.log("✔ Program Manager Program deployed.");
        deployRoles();
        console.log("✔ Roles Program deployed.");
        console.log("Finished deploying programs.");

        program = anchor.workspace.SquadsMpl as Program<SquadsMpl>;
        squads = Squads.localnet(provider.wallet, {
          commitmentOrConfig: provider.connection.commitment,
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

      it.skip(`Tx Activate`,  async function(){
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

      it.skip(`Tx Sign`,  async function(){
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

      it.skip(`Transfer Tx Execute`,  async function(){
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

      it(`Add 2 ixes with args`, async function() {
        // create authority to use (Vault, index 1)
        const authorityPDA = squads.getAuthorityPDA(msPDA, 1);

        // the test transfer instruction (2x)
        const testPayee = anchor.web3.Keypair.generate();
        const testIx = await createTestTransferTransaction(
          authorityPDA,
          testPayee.publicKey
        );
        // console.log("test ix 1", testIx);
        // console.log("test ix 2", testIx);
        const testIx2x = await createTestTransferTransaction(
          authorityPDA,
          testPayee.publicKey
        );
        let txState = await squads.createTransaction(msPDA, 1);
        const accountKeys =  getUniqueAccountKeys([testIx, testIx2x]);
        const compressedIxes = getCompressedIxes(accountKeys, [testIx, testIx2x]);
        const [ix_1_pda] = await getIxPDA(txState.publicKey, new BN(1), program.programId);
        const [ix_2_pda] = await getIxPDA(txState.publicKey, new BN(2), program.programId);
        const ixArgs = {
          accountKeys,
          instructions: compressedIxes,
          activate: true,
        };

        await program.methods.addInstructions(ixArgs)
        .accounts({
          multisig: msPDA,
          transaction: txState.publicKey,
          creator: provider.wallet.publicKey
        })
        .remainingAccounts([
          {pubkey: ix_1_pda, isWritable: true, isSigner: false},
          {pubkey: ix_2_pda, isWritable: true, isSigner: false},
        ])
        .rpc({
          commitment: "confirmed",
          skipPreflight: true
        });
        let newTxState = await squads.getTransaction(txState.publicKey);
        expect(newTxState.status).to.have.property("active");
        await squads.approveTransaction(newTxState.publicKey);
        newTxState = await squads.getTransaction(txState.publicKey);
        expect(newTxState.status).to.have.property("executeReady");
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

      it.skip(`getInstructionsV2 wrapping overhead`, async function() {
        // MagicEden Buy NFT tx.
        const originalTransactionBytes = Buffer.from("AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADG/omv6Y6TpmfPm8Nv6uNO4+wIbpMEEpge++pjCXRJHafnAD+atFsxBtGSsVJXKlU4Rl6LPqgxCvgP8JumX6oPAgEJFC5dOl5gTFIBGhqhRA1l5a37hvQcbqsoqopVp5/pQYTtBX82VZkozhurrbZbi12eMbon+FOb7GAsyxrcKvufRnAQwjfwGJSgD4Qx0lgbtYjba02lQTrXoi+Tt9Hud6q5Zm1LzHez3eRpORE62bQk660HWs5JWsTpCUHKqqhKVzL1e/B6uWe1EG6asiC4kn2+anSeJL+Qx/12GYG+NwKoDacIr/bkEFkkZq+bSGvldnny9otBzdwx4CCSd0qPY2LtE5bClE7fneICXVOO6oTpkyP9dXySB6bpu2/M37UbiZtNw4tiKyS0JeN3O5NSihi69ksZEzxISUzTz0XmVuIZNPDljbFniLvsim6dTEc5cyoTN2b5SA3mE/vy52heCKtBsPXNul2WH2NlJWV4rgdiwGbP4az6UWif8kpvy7OdE3osDJ465OC3mEr6Ep1gB6Ce4I6WLqHK2kna5hIyk8K/w30AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL4+HroXpHP4mw9+jiSUDyCuuOvKcaiP3pXUuDtxoJYXXCW/Z3CCGN/ozP5mL25z8cjQQJ33WfsLAUj1rzV8OMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WcMbGMw+FIoKUpOBiSDt+u2rOR5JM2wLdNtmnRBHA0JL8XzARhMFxip/gfka6l966UK5BlOVMWaJrkUqN+gSCLcFIZ+JmoHU/4T7WT0u34qQrBs6s0JY998jPqUDArG9Lgan1RcZLFxRIYzJTD1K8X9Y2u4Im6H9ROPb2YoAAAAABt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKldDKr4rGlLvd88tmWtp8Um26HSn9iSxwtdR5YtN8SLAgQRBgABCAUPCxHyI8aJUuHytv5Apa4CAAAAABEMAAENEAgFDwMFEwsSImYGPRIB2uvq/P5Apa4CAAAAAAEAAAAAAAAAAAAAAAAAAAARFAAEAQINEAgJBQ8KAwUHBRMLDgwSKiVK2Z1PMSMG/vpApa4CAAAAAAEAAAAAAAAAAAAAAAAAAAD//////////wsCAAYMAgAAAOhgLwAAAAAA", "base64");
        expect(originalTransactionBytes.length).to.equal(963);

        const originalTransaction = anchor.web3.Transaction.from(originalTransactionBytes);
        const originalInstructions = originalTransaction.instructions;

        const txBuilder = await squads.getTransactionBuilder(msPDA, 1);
        const [wrappedInstructions] = await txBuilder
          .withInstructions(originalInstructions)
          .getInstructionsV2({ activate: true });

        const wrappedTx = new Transaction();
        wrappedTx.recentBlockhash = originalTransaction.recentBlockhash;
        wrappedTx.feePayer = creator.publicKey;
        wrappedTx.add(...wrappedInstructions);
        const wrappedTxBytes = wrappedTx.serialize({ requireAllSignatures: false })
        console.log("Serialized wrapped tx size:", wrappedTxBytes.length) // 1319 (overhead 356)
      })

      it(`createTransactionV2 wrapping overhead`, async function() {
        // MagicEden Buy NFT tx.
        const originalTransactionBytes = Buffer.from("AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADG/omv6Y6TpmfPm8Nv6uNO4+wIbpMEEpge++pjCXRJHafnAD+atFsxBtGSsVJXKlU4Rl6LPqgxCvgP8JumX6oPAgEJFC5dOl5gTFIBGhqhRA1l5a37hvQcbqsoqopVp5/pQYTtBX82VZkozhurrbZbi12eMbon+FOb7GAsyxrcKvufRnAQwjfwGJSgD4Qx0lgbtYjba02lQTrXoi+Tt9Hud6q5Zm1LzHez3eRpORE62bQk660HWs5JWsTpCUHKqqhKVzL1e/B6uWe1EG6asiC4kn2+anSeJL+Qx/12GYG+NwKoDacIr/bkEFkkZq+bSGvldnny9otBzdwx4CCSd0qPY2LtE5bClE7fneICXVOO6oTpkyP9dXySB6bpu2/M37UbiZtNw4tiKyS0JeN3O5NSihi69ksZEzxISUzTz0XmVuIZNPDljbFniLvsim6dTEc5cyoTN2b5SA3mE/vy52heCKtBsPXNul2WH2NlJWV4rgdiwGbP4az6UWif8kpvy7OdE3osDJ465OC3mEr6Ep1gB6Ce4I6WLqHK2kna5hIyk8K/w30AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAL4+HroXpHP4mw9+jiSUDyCuuOvKcaiP3pXUuDtxoJYXXCW/Z3CCGN/ozP5mL25z8cjQQJ33WfsLAUj1rzV8OMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WcMbGMw+FIoKUpOBiSDt+u2rOR5JM2wLdNtmnRBHA0JL8XzARhMFxip/gfka6l966UK5BlOVMWaJrkUqN+gSCLcFIZ+JmoHU/4T7WT0u34qQrBs6s0JY998jPqUDArG9Lgan1RcZLFxRIYzJTD1K8X9Y2u4Im6H9ROPb2YoAAAAABt324ddloZPZy+FGzut5rBy0he1fWzeROoz1hX7/AKldDKr4rGlLvd88tmWtp8Um26HSn9iSxwtdR5YtN8SLAgQRBgABCAUPCxHyI8aJUuHytv5Apa4CAAAAABEMAAENEAgFDwMFEwsSImYGPRIB2uvq/P5Apa4CAAAAAAEAAAAAAAAAAAAAAAAAAAARFAAEAQINEAgJBQ8KAwUHBRMLDgwSKiVK2Z1PMSMG/vpApa4CAAAAAAEAAAAAAAAAAAAAAAAAAAD//////////wsCAAYMAgAAAOhgLwAAAAAA", "base64");
        expect(originalTransactionBytes.length).to.equal(963);

        const originalTransaction = anchor.web3.Transaction.from(originalTransactionBytes);
        const originalInstructions = originalTransaction.instructions;

        const txBuilder = await squads.getTransactionBuilder(msPDA, 1);
        const [createTransactionInstruction] = await txBuilder
          .withInstructions(originalInstructions)
          .createTransactionV2();

        const wrappedTx = new Transaction();
        wrappedTx.recentBlockhash = originalTransaction.recentBlockhash;
        wrappedTx.feePayer = creator.publicKey;
        wrappedTx.add(createTransactionInstruction);
        const wrappedTxBytes = wrappedTx.serialize({ requireAllSignatures: false })
        const overhead = wrappedTxBytes.length - originalTransactionBytes.length
        // expect(overhead).to.equal(208); // Getting rid of remaining_account
        expect(overhead).to.equal(148); // Using optimized header
      })

      it.skip(`2X Transfer Tx Execute`, async function() {
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

      it.skip(`2X Transfer Tx Sequential execute`, async function(){
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

      it.skip(`Change ms size with realloc`, async function(){
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

        try {
          await squads.executeTransaction(txPDA);
        } catch (e) {
          console.log("EXECUTE ERROR");
          console.log(e);
        }
        const msState = await squads.getMultisig(msPDA);
        msAccount = await program.provider.connection.getParsedAccountInfo(msPDA);
        const endRentLamports = msAccount.value.lamports;
        expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 1);
        expect(endRentLamports).to.be.greaterThan(startRentLamports);
      });

      it.skip(`Add a new member but creator is not executor`, async function(){
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

        await squads.executeTransaction(txPDA, member2.publicKey, [member2]);

        const msState = await squads.getMultisig(msPDA);
        expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 2);
      });

      it.skip(`Transaction instruction failure`, async function(){
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

      it.skip(`Change threshold test`, async function(){
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

      it.skip(`Insufficient approval failure`, async function(){
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

      it.skip(`Change vote from approved to rejected`, async function(){
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

      it.skip(`Add a new member & change threshold (conjoined)`, async function(){
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
        await squads.executeTransaction(txPDA, payer.publicKey, [payer]);
        txState = await squads.getTransaction(txPDA);
        expect(txState.status).has.property("executed");
        msState = await squads.getMultisig(msPDA);
        threshold = msState.threshold;
        expect((msState.keys as any[]).length).to.equal(numberOfMembersTotal + 3);
        expect(msState.threshold).to.equal(1);
      });
    });

    describe.skip("Program upgrades", () => {
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
    describe("Roles Program", async function(){
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

  // test suite for the mesh program
  describe.skip("Mesh Program", function(){
    let meshProgram;
    let ms;
    let members = [
      anchor.web3.Keypair.generate(),
      anchor.web3.Keypair.generate(),
      anchor.web3.Keypair.generate(),
    ];
    const createKey = anchor.web3.Keypair.generate().publicKey;

    this.beforeAll(async function(){
      deployMesh();
      console.log("✔ Mesh Program deployed.");
      meshProgram = anchor.workspace.Mesh as Program<Mesh>;
      [ms] = await getMsPDA(createKey, meshProgram.programId);
      await provider.connection.requestAirdrop(members[0].publicKey, anchor.web3.LAMPORTS_PER_SOL * 2);
      await provider.connection.requestAirdrop(members[1].publicKey, anchor.web3.LAMPORTS_PER_SOL * 2);
      await provider.connection.requestAirdrop(members[2].publicKey, anchor.web3.LAMPORTS_PER_SOL * 2);
    });

    it("Create a multisig", async function(){
        let initMembers = [
            members[0].publicKey,
            members[1].publicKey,
            members[2].publicKey
        ];
        try {
            await meshProgram.methods.create(provider.wallet.publicKey, 1, createKey, initMembers)
                .accounts({
                    multisig: ms,
                    creator: provider.wallet.publicKey
                })
                .rpc();
        }catch(e) {
            console.log(e);
        }

        const msState = await meshProgram.account.ms.fetch(ms);
        expect(msState.externalAuthority.toBase58()).to.equal(provider.wallet.publicKey.toBase58());
    });

    it("External remove", async function(){
        // get the state
        let msState = await meshProgram.account.ms.fetch(ms);
        const keyCount = (msState.keys as anchor.web3.PublicKey[]).length;
        // find a key to remove
        const removeKey = (msState.keys as anchor.web3.PublicKey[]).shift();
        try {
            await meshProgram.methods.removeMember(removeKey)
                .accounts({
                    multisig: ms,
                })
                .rpc();
        }catch(e){
            console.log(e);
        }
        msState = await meshProgram.account.ms.fetch(ms);
        expect((msState.keys as anchor.web3.PublicKey[]).length).to.equal(keyCount-1);
    });

    it("Internal remove failure", async function(){
        // get the state
        let msState = await meshProgram.account.ms.fetch(ms);
        const keyCount = (msState.keys as anchor.web3.PublicKey[]).length;
        // find a key to remove
        const removeKey = (msState.keys as anchor.web3.PublicKey[]).shift();
        const signerIndex = members.findIndex((k)=>{
            return k.publicKey.toBase58() === removeKey.toBase58();
        });
        const signer = members[signerIndex];

        const removeIx = await meshProgram.methods.removeMember(removeKey)
            .accounts({
                multisig: ms,
            })
            .instruction();
        try {
            const removeTx = new anchor.web3.Transaction();
            removeIx.keys.pop();
            removeIx.keys.push({
                pubkey: signer.publicKey,
                isWritable: true,
                isSigner: true,
            });
            removeTx.add(removeIx);
            await provider.sendAndConfirm(removeTx,[signer]);
        }catch(e){
            // want failure here
            // console.log(e);
        }
        msState = await meshProgram.account.ms.fetch(ms);
        expect((msState.keys as anchor.web3.PublicKey[]).length).to.equal(keyCount);
    });

    it("Vault withdrawal test - default authority", async function() {
        const msState = await meshProgram.account.ms.fetch(ms);
        const [vault] = await getAuthorityPDA(ms, new anchor.BN(1), meshProgram.programId);
        const withdrawIx = await createTestTransferTransaction(vault, provider.wallet.publicKey, anchor.web3.LAMPORTS_PER_SOL);
        const [tx] = await getTxPDA(ms, new anchor.BN(msState.transactionIndex + 1), meshProgram.programId);
        
        // go through the current member keys and find a signer
        const signerPubkey = (msState.keys as anchor.web3.PublicKey[])[0];
        const signerIndex = members.findIndex((k)=>{
            return k.publicKey.toBase58() === signerPubkey.toBase58();
        });

        const signer = members[signerIndex];

        // create the tx with authority 1
        try {
            await meshProgram.methods.createTransaction(1)
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc();
        }catch(e){
            console.log(e);
        }

        const [ix] = await getIxPDA(tx, new anchor.BN(1), meshProgram.programId);
        // add an instruction to use the default TX authority declared above
        try {
            await meshProgram.methods.addInstruction(withdrawIx, null, null, {default:{}})
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    instruction: ix,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc()
        }catch(e) {
            console.log(e);
        }

        // activate and approve
        try {
            await meshProgram.methods.activateTransaction()
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc();
            
            await meshProgram.methods.approveTransaction()
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    member: signer.publicKey
                })
                .signers([signer])
                .rpc();
        }catch(e) {
            console.log(e);
        }

        let txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executeReady");

        // airdrop 2 SOL to the vault
        try {
            const ad = await provider.connection.requestAirdrop(vault, anchor.web3.LAMPORTS_PER_SOL);
            await provider.connection.confirmTransaction(ad);
        }catch(e){
            console.log(e);
        }
        const vaultAccount = await provider.connection.getAccountInfo(vault);

        // execute the transaction
        try {
            await executeTransaction(tx, signer as unknown as anchor.Wallet, provider, meshProgram, signer.publicKey, [signer])
        }catch(e){
            console.log(e);
        }
        
        txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executed");
    });

    it("Vault withdrawal test - 2 different authorities", async function() {
        const msState = await meshProgram.account.ms.fetch(ms);
        const [vault1] = await getAuthorityPDA(ms, new anchor.BN(1), meshProgram.programId);
        const [vault2, vault2Bump] = await getAuthorityPDA(ms, new anchor.BN(2), meshProgram.programId);
        const withdrawIx1 = await createTestTransferTransaction(vault1, provider.wallet.publicKey, anchor.web3.LAMPORTS_PER_SOL);
        const withdrawIx2 = await createTestTransferTransaction(vault2, provider.wallet.publicKey, anchor.web3.LAMPORTS_PER_SOL);

        const [tx] = await getTxPDA(ms, new anchor.BN(msState.transactionIndex + 1), meshProgram.programId);
        
        // go through the current member keys and find a signer
        const signerPubkey = (msState.keys as anchor.web3.PublicKey[])[0];
        const signerIndex = members.findIndex((k)=>{
            return k.publicKey.toBase58() === signerPubkey.toBase58();
        });

        const signer = members[signerIndex];

        // transfer 2 SOL to the vaults
        const vault1TransferTx = new anchor.web3.Transaction();
        const vault2TransferTx = new anchor.web3.Transaction();
        const vault1TransferIx = await createTestTransferTransaction(provider.wallet.publicKey, vault1, anchor.web3.LAMPORTS_PER_SOL * 2);
        const vault2Transferix = await createTestTransferTransaction(provider.wallet.publicKey, vault2, anchor.web3.LAMPORTS_PER_SOL * 2);
        vault1TransferTx.add(vault1TransferIx);
        vault2TransferTx.add(vault2Transferix);
        
        await meshProgram.provider.sendAll([{tx: vault1TransferTx}, {tx: vault2TransferTx}]);
        
        // create the tx with authority 1
        try {
            await meshProgram.methods.createTransaction(1)
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc();
        }catch(e){
            console.log(e);
        }


        // add an instruction to use the default TX authority declared above
        const [ix1] = await getIxPDA(tx, new anchor.BN(1), meshProgram.programId);

        try {
            await meshProgram.methods.addInstruction(withdrawIx1, null, null, {default:{}})
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    instruction: ix1,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc()
        }catch(e) {
            console.log(e);
        }

        // add an instruction to use the default vault 2 TX authority declared above
        const [ix2] = await getIxPDA(tx, new anchor.BN(2), meshProgram.programId);
        try {
            await meshProgram.methods.addInstruction(withdrawIx2, 2, vault2Bump, {default:{}})
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    instruction: ix2,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc()
        }catch(e) {
            console.log(e);
        }

        // activate and approve
        try {
            await meshProgram.methods.activateTransaction()
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc();
            
            await meshProgram.methods.approveTransaction()
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    member: signer.publicKey
                })
                .signers([signer])
                .rpc();
        }catch(e) {
            console.log(e);
        }

        let txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executeReady");

        // make sure the vaults are funded
        const vaultStartBalance1 = await provider.connection.getAccountInfo(vault1, "confirmed");
        const vaultStartBalance2 = await provider.connection.getAccountInfo(vault2, "confirmed");
        
        expect(vaultStartBalance1.lamports).to.be.greaterThan(0);
        expect(vaultStartBalance2.lamports).to.be.greaterThan(0);
        // execute the transaction
        try {
            await executeTransaction(tx, signer as unknown as anchor.Wallet, provider, meshProgram, signer.publicKey, [signer])
        }catch(e){
            console.log(e);
        }
        
        const vaultEndBalance1 = await provider.connection.getAccountInfo(vault1);
        const vaultEndBalance2 =  await provider.connection.getAccountInfo(vault2);
        txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executed");

        expect(vaultEndBalance1.lamports).to.equal(vaultStartBalance1.lamports - anchor.web3.LAMPORTS_PER_SOL);
        expect(vaultEndBalance2.lamports).to.equal(vaultStartBalance2.lamports - anchor.web3.LAMPORTS_PER_SOL);
    });

    it("Transfer from vault to custom PDA, then transfer to vault 2", async function(){
        const msState = await meshProgram.account.ms.fetch(ms);
        // get next expected tx PDA
        const [tx] = await getTxPDA(ms, new anchor.BN(msState.transactionIndex + 1), meshProgram.programId);
        const [vault] = await getAuthorityPDA(ms, new anchor.BN(1), meshProgram.programId);
        const [vault2] = await getAuthorityPDA(ms, new anchor.BN(2), meshProgram.programId);
        // get the custom ix pda
        const [customIxPda, customIxPdaBump] = await getIxAuthority(tx, new anchor.BN(1), meshProgram.programId);
        // transfer from default vault to custom ix authority
        const withdrawIx = await createTestTransferTransaction(vault, customIxPda, anchor.web3.LAMPORTS_PER_SOL);
        // transfer from custom ix authority to vault 2
        const transferFromCustomIx = await createTestTransferTransaction(customIxPda, vault2, anchor.web3.LAMPORTS_PER_SOL);
        
        // go through the current member keys and find a signer
        const signerPubkey = (msState.keys as anchor.web3.PublicKey[])[0];
        const signerIndex = members.findIndex((k)=>{
            return k.publicKey.toBase58() === signerPubkey.toBase58();
        });

        const signer = members[signerIndex];

        // transfer 2 SOL to the vault
        const vaultTransferTx = new anchor.web3.Transaction();
        const vaultTransferIx = await createTestTransferTransaction(provider.wallet.publicKey, vault, anchor.web3.LAMPORTS_PER_SOL * 2);
        vaultTransferTx.add(vaultTransferIx);
        
        // vault 1 is funded
        await meshProgram.provider.sendAll([{tx: vaultTransferTx}]);

        // create the tx with authority 1 as default
        try {
            await meshProgram.methods.createTransaction(1)
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc();
        }catch(e){
            console.log(e);
        }


        // add an instruction to use the default TX authority declared above
        const [ix1] = await getIxPDA(tx, new anchor.BN(1), meshProgram.programId);
        // transfer from default vault to custom ix authority
        try {
            await meshProgram.methods.addInstruction(withdrawIx, null, null, {default:{}})
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    instruction: ix1,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc()
        }catch(e) {
            console.log(e);
        }

        // add instruction to transfer from the custom pda to vault 2
        const [ix2] = await getIxPDA(tx, new anchor.BN(2), meshProgram.programId);
        try {
            await meshProgram.methods.addInstruction(transferFromCustomIx, 1, customIxPdaBump, {custom:{}})
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    instruction: ix2,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc()
        }catch(e) {
            console.log(e);
        }

        // activate and approve
        try {
            await meshProgram.methods.activateTransaction()
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    creator: signer.publicKey
                })
                .signers([signer])
                .rpc();
            
            await meshProgram.methods.approveTransaction()
                .accounts({
                    multisig: ms,
                    transaction: tx,
                    member: signer.publicKey
                })
                .signers([signer])
                .rpc();
        }catch(e) {
            console.log(e);
        }

        let txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executeReady");

        // make sure the vaults are funded
        const vaultStartBalance1 = await provider.connection.getAccountInfo(vault, "confirmed");
        const vaultStartBalance2 = await provider.connection.getAccountInfo(vault2, "confirmed");
        expect(vaultStartBalance1.lamports).to.be.greaterThan(0);
        // execute the transaction
        try {
            await executeTransaction(tx, signer as unknown as anchor.Wallet, provider, meshProgram, signer.publicKey, [signer])
        }catch(e){
            console.log(e);
        }
        
        const vaultEndBalance1 = await provider.connection.getAccountInfo(vault);
        const vaultEndBalance2 =  await provider.connection.getAccountInfo(vault2);
        txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executed");

        expect(vaultEndBalance1.lamports).to.equal(vaultStartBalance1.lamports - anchor.web3.LAMPORTS_PER_SOL);
        expect(vaultEndBalance2.lamports).to.equal(vaultStartBalance2.lamports + anchor.web3.LAMPORTS_PER_SOL);
    });

    it("Create a token mint based off the custom ix PDA", async function(){
      const tokenProgram = anchor.Spl.token(provider);
      const ataProgram = anchor.Spl.associatedToken(provider);
      const mintAmount = 100000;
      const systemProgram = anchor.web3.SystemProgram;
      const msState = await meshProgram.account.ms.fetch(ms);
      // get next expected tx PDA
      const [tx] = await getTxPDA(ms, new anchor.BN(msState.transactionIndex + 1), meshProgram.programId);
      const [vault, vaultBump] = await getAuthorityPDA(ms, new anchor.BN(1), meshProgram.programId);
      const [vault2, vault2Bump] = await getAuthorityPDA(ms, new anchor.BN(2), meshProgram.programId);

      const [ix1] = await getIxPDA(tx, new anchor.BN(1), meshProgram.programId);
      const [ix2] = await getIxPDA(tx, new anchor.BN(2), meshProgram.programId);

      // go through the current member keys and find a signer
      const signerPubkey = (msState.keys as anchor.web3.PublicKey[])[0];
      const signerIndex = members.findIndex((k)=>{
          return k.publicKey.toBase58() === signerPubkey.toBase58();
      });

      const signer = members[signerIndex];

      // create the tx with authority 1 as default
      try {
        await meshProgram.methods.createTransaction(1)
            .accounts({
                multisig: ms,
                transaction: tx,
                creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
      }catch(e){
          console.log(e);
      }

      // use the tx custom authority to be the new mint account
      const [newMintPda, newMintPdaBump] = await getIxAuthority(tx, new anchor.BN(1), meshProgram.programId);
      const [vault1Ata] = await anchor.web3.PublicKey.findProgramAddress([
          vault.toBuffer(),
          TOKEN_PROGRAM_ID.toBuffer(),
          newMintPda.toBuffer()
        ], ataProgram.programId
      );
      const [vault2Ata] = await anchor.web3.PublicKey.findProgramAddress([
        vault2.toBuffer(),
        TOKEN_PROGRAM_ID.toBuffer(),
        newMintPda.toBuffer()
      ], ataProgram.programId
    );

      const createMintAccountIx = await systemProgram.createAccount({
          fromPubkey: vault,
          newAccountPubkey: newMintPda,
          lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
          space: 82,
          programId: tokenProgram.programId
      });

      const initializeMintIx = await tokenProgram.methods.initializeMint(
          0,
          vault,
          null
        )
        .accounts({
          mint: newMintPda,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .instruction();

      // add the two mint instructions
        try {
          await meshProgram.methods.addInstruction(createMintAccountIx, 1, newMintPdaBump, {custom:{}})
              .accounts({
                  multisig: ms,
                  transaction: tx,
                  instruction: ix1,
                  creator: signer.publicKey
              })
              .signers([signer])
              .rpc();
        }catch(e){
            console.log(e);
        }

        try {
          await meshProgram.methods.addInstruction(initializeMintIx, 1, newMintPdaBump, {custom:{}})
            .accounts({
              multisig: ms,
              transaction: tx,
              instruction: ix2,
              creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }

        // mint to vault 1 instruction - with ata creation
        // mint to vault 2 instruction - with ata creation
        const [ix3] = await getIxPDA(tx, new anchor.BN(3), meshProgram.programId);
        const [ix4] = await getIxPDA(tx, new anchor.BN(4), meshProgram.programId);

        const vault1AtaIx = await ataProgram.methods.create().accounts({
          authority: vault,
          mint: newMintPda,
          associatedAccount: vault1Ata,
          owner: vault
          
        }).instruction();

        try {
          await meshProgram.methods.addInstruction(vault1AtaIx, 1, vaultBump, {default:{}})
            .accounts({
              multisig: ms,
              transaction: tx,
              instruction: ix3,
              creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }

        const vault2AtaIx = await ataProgram.methods.create().accounts({
          authority: vault2,
          mint: newMintPda,
          associatedAccount: vault2Ata,
          owner: vault2
        }).instruction();

        try {
          await meshProgram.methods.addInstruction(vault2AtaIx, 2, vault2Bump, {default:{}})
            .accounts({
              multisig: ms,
              transaction: tx,
              instruction: ix4,
              creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }

        // now add the mintTo to instructions for each ata
        const [ix5] = await getIxPDA(tx, new anchor.BN(5), meshProgram.programId);
        const [ix6] = await getIxPDA(tx, new anchor.BN(6), meshProgram.programId);
        const mintToVault1Ix = await tokenProgram.methods.mintTo(new anchor.BN(mintAmount)).accounts({
          mint: newMintPda,
          to: vault1Ata,
          authority: vault
        }).instruction();

        const mintToVault2Ix = await tokenProgram.methods.mintTo(new anchor.BN(mintAmount)).accounts({
          mint: newMintPda,
          to: vault2Ata,
          authority: vault
        }).instruction();

        // since the default TX authority is the vault1, and holds authority over the mint, these 2 ixes can use the default authority
        try {
          await meshProgram.methods.addInstruction(mintToVault1Ix, null, null, {default:{}})
            .accounts({
              multisig: ms,
              transaction: tx,
              instruction: ix5,
              creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }
        try {
          await meshProgram.methods.addInstruction(mintToVault2Ix, null, null, {default:{}})
            .accounts({
              multisig: ms,
              transaction: tx,
              instruction: ix6,
              creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }        


        // activate and approve
        try {
          await meshProgram.methods.activateTransaction()
            .accounts({
              multisig: ms,
              transaction: tx,
              creator: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }

        try {
          await meshProgram.methods.approveTransaction()
            .accounts({
              multisig: ms,
              transaction: tx,
              member: signer.publicKey
            })
            .signers([signer])
            .rpc();
        }catch(e){
            console.log(e);
        }

        let txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executeReady");

        // execute the transaction
        try {
          await executeTransaction(tx, signer as unknown as anchor.Wallet, provider, meshProgram, signer.publicKey, [signer])
        }catch(e){
          console.log(e);
        }
        txState = await meshProgram.account.msTransaction.fetch(tx);
        expect(txState.status).to.haveOwnProperty("executed");

        // check that the ATAs have the minted balances:
        const vault1AtaState = await provider.connection.getParsedAccountInfo(vault1Ata);
        const vault2AtaState = await provider.connection.getParsedAccountInfo(vault2Ata);
        expect(vault1AtaState.value.data.parsed.info.tokenAmount.uiAmount).to.equal(mintAmount);
        expect(vault2AtaState.value.data.parsed.info.tokenAmount.uiAmount).to.equal(mintAmount);
    });
  });

});

function getUniqueAccountKeys(ixes: anchor.web3.TransactionInstruction[]) {
  const aK: anchor.web3.PublicKey[] = [];
  for (let ix of ixes) {
    // attempted to make compressed instruction and set account_keys
    const pIndex = aK.findIndex((k)=>{
      return k.equals(ix.programId);
    });
    if (pIndex === -1) {
      aK.push(ix.programId);
    }

    for (let k of ix.keys) {
      const kIndex = aK.findIndex((key)=>{
        return key.equals(k.pubkey);
      });
      if (kIndex === -1) {
        aK.push(k.pubkey);
      }
    }
  }
  return aK;
}


function getCompressedIxes(accountKeys: anchor.web3.PublicKey[], ixes: anchor.web3.TransactionInstruction[]) {
  return ixes.map(ix => {
    return {
      programIdIndex: accountKeys.findIndex((k) => {
        return k.equals(ix.programId);
      }),
      accountIndexes: Buffer.from(ix.keys.map(k => {
        return accountKeys.findIndex((key) => {
          return key.equals(k.pubkey);
        });
      })),
      signerIndexes: Buffer.from(ix.keys.filter(k => k.isSigner).map(k => {
        return accountKeys.findIndex((key) => {
            return key.equals(k.pubkey);
          }
        )})),
      writableIndexes: Buffer.from(ix.keys.filter(k => k.isWritable).map(k => {
        return accountKeys.findIndex((key) => {
            return key.equals(k.pubkey);
          }
        )})),
      data: ix.data,
    };
  });
}
