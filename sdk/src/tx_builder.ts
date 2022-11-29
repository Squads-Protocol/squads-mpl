import {
  MultisigAccount,
  ProgramManagerMethodsNamespace,
  SquadsMethodsNamespace,
} from "./types";
import {AccountMeta, PublicKey, TransactionInstruction} from "@solana/web3.js"
import { getAuthorityPDA, getIxPDA, getTxPDA } from "./address";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";
import * as anchor from "@project-serum/anchor";

export class TransactionBuilder {
  multisig: MultisigAccount;
  authorityIndex: number;
  private readonly methods: SquadsMethodsNamespace;
  private readonly managerMethods: ProgramManagerMethodsNamespace;
  private readonly provider: AnchorProvider;
  readonly programId: PublicKey;
  private instructions: TransactionInstruction[];
  constructor(
    methods: SquadsMethodsNamespace,
    managerMethods: ProgramManagerMethodsNamespace,
    provider: AnchorProvider,
    multisig: MultisigAccount,
    authorityIndex: number,
    programId: PublicKey,
    instructions?: TransactionInstruction[]
  ) {
    this.methods = methods;
    this.managerMethods = managerMethods;
    this.provider = provider;
    this.multisig = multisig;
    this.authorityIndex = authorityIndex;
    this.programId = programId;
    this.instructions = instructions ?? [];
  }

  private async _buildAddInstruction(
    transactionPDA: PublicKey,
    instruction: TransactionInstruction,
    instructionIndex: number
  ): Promise<TransactionInstruction> {
    const [instructionPDA] = getIxPDA(
      transactionPDA,
      new BN(instructionIndex, 10),
      this.programId
    );
    return await this.methods
      .addInstruction(instruction)
      .accounts({
        multisig: this.multisig.publicKey,
        transaction: transactionPDA,
        instruction: instructionPDA,
        creator: this.provider.wallet.publicKey,
      })
      .instruction();
  }
  private async _buildAddInstructions(
    transactionPDA: PublicKey,
    instructions: TransactionInstruction[],
    activate: boolean
  ): Promise<TransactionInstruction> {
    // Populate unique account keys.
    const accountKeys: PublicKey[] = [];
    for (const ix of instructions) {
      if (!accountKeys.find(k => k.equals(ix.programId))) {
        accountKeys.push(ix.programId);
      }
      for (const meta of ix.keys) {
        if (!accountKeys.find(k => k.equals(meta.pubkey))) {
          accountKeys.push(meta.pubkey);
        }
      }
    }

    return await this.methods
      .addInstructions({
        accountKeys,
        instructions: instructions.map(ix => {
          return {
            programIdIndex: accountKeys.findIndex(k => k.equals(ix.programId)),
            accountIndexes: Buffer.from(
              ix.keys.map(meta => accountKeys.findIndex(k => k.equals(meta.pubkey)))
            ),
            signerIndexes: Buffer.from(ix.keys
              .filter(meta => meta.isSigner)
              .map(meta => accountKeys.findIndex(k => k.equals(meta.pubkey)))),
            writableIndexes: Buffer.from(ix.keys
              .filter(meta => meta.isWritable)
              .map(meta => accountKeys.findIndex(k => k.equals(meta.pubkey)))),
            data: ix.data,
          }
        }),
        activate,
      })
      .accounts({
        multisig: this.multisig.publicKey,
        transaction: transactionPDA,
        creator: this.provider.wallet.publicKey,
      })
      .remainingAccounts(Array.from({ length: instructions.length }, (_, index) => {
          return {
            pubkey: getIxPDA(transactionPDA, new BN(index + 1, 10), this.programId)[0],
            isSigner: false,
            isWritable: true,
          };
        })
      )
      .instruction();
  }

  private async _buildCreateTransactionV2(
    transactionPDA: PublicKey,
    instructions: TransactionInstruction[],
  ): Promise<TransactionInstruction> {
    // Populate unique account keys.
    const accountMetas: AccountMeta[] = [];
    for (const ix of instructions) {
      if (!accountMetas.find(k => k.pubkey.equals(ix.programId))) {
        accountMetas.push({ pubkey: ix.programId, isSigner: false, isWritable: false });
      }

      for (const meta of ix.keys) {
        const foundMeta = accountMetas.find(k => k.pubkey.equals(meta.pubkey))
        if (!foundMeta) {
          accountMetas.push(meta);
        } else {
          foundMeta.isSigner ||= meta.isSigner;
          foundMeta.isWritable ||= meta.isWritable;
        }
      }
    }

    const {
      numSigners,
      numWritableSigners,
      numWritableNonSigners
    } = accountMetas.reduce((res, meta) => {
      if (meta.isSigner) {
        res.numSigners += 1;
        if (meta.isWritable) {
          res.numWritableSigners += 1;
        }
      } else if (meta.isWritable) {
        res.numWritableNonSigners += 1;
      }

      return res;
    }, {
      numSigners: 0,
      numWritableSigners: 0,
      numWritableNonSigners: 0
    })

    const accountKeys = accountMetas.sort(
      (a, b) => {
        // Signers come before non-signers.
        if (a.isSigner && !b.isSigner) {
          return -1;
        }
        if (!a.isSigner && b.isSigner) {
          return 1;
        }

        // Writable come before read-only.
        if (a.isWritable && !b.isWritable) {
          return -1;
        }
        if (!a.isWritable && b.isWritable) {
          return 1;
        }

        return 0;
      })
      .map(meta => meta.pubkey);

    return await this.methods
      .createTransactionV2({
        authorityIndex: this.authorityIndex,
        accountKeys,
        numSigners,
        numWritableSigners,
        numWritableNonSigners,
        instructions: instructions.map(ix => {
          return {
            programIdIndex: accountKeys.findIndex(k => k.equals(ix.programId)),
            accountIndexes: Buffer.from(
              ix.keys.map(meta => accountKeys.findIndex(k => k.equals(meta.pubkey)))
            ),
            data: ix.data,
          }
        }),
      })
      .accounts({
        multisig: this.multisig.publicKey,
        transaction: transactionPDA,
        creator: this.provider.wallet.publicKey,
      })
      .instruction();
  }
  private _cloneWithInstructions(
    instructions: TransactionInstruction[]
  ): TransactionBuilder {
    return new TransactionBuilder(
      this.methods,
      this.managerMethods,
      this.provider,
      this.multisig,
      this.authorityIndex,
      this.programId,
      instructions
    );
  }
  transactionPDA() {
    const [transactionPDA] = getTxPDA(
      this.multisig.publicKey,
      new BN(this.multisig.transactionIndex + 1),
      this.programId
    );
    return transactionPDA;
  }
  async createTransactionV2(): Promise<[TransactionInstruction, PublicKey]> {
    const transactionPDA = this.transactionPDA();
    const createTxInstruction = await this._buildCreateTransactionV2(transactionPDA, this.instructions);
    this.instructions = [];
    return [createTxInstruction, transactionPDA];
  }
  withInstruction(instruction: TransactionInstruction): TransactionBuilder {
    return this._cloneWithInstructions(this.instructions.concat(instruction));
  }
  withInstructions(instructions: TransactionInstruction[]): TransactionBuilder {
    const newInstructions = [];
    for (let i = 0; i < instructions.length; i++) {
      newInstructions.push(instructions[i]);
    }
    return this._cloneWithInstructions(
      this.instructions.concat(newInstructions)
    );
  }
  async withAddMember(member: PublicKey): Promise<TransactionBuilder> {
    const instruction = await this.methods
      .addMember(member)
      .accounts({
        multisig: this.multisig.publicKey,
        multisigAuth: this.multisig.publicKey,
        member,
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  async withAddMemberAndChangeThreshold(
    member: PublicKey,
    threshold: number
  ): Promise<TransactionBuilder> {
    const instruction = await this.methods
      .addMemberAndChangeThreshold(member, threshold)
      .accounts({
        multisig: this.multisig.publicKey,
        multisigAuth: this.multisig.publicKey,
        member,
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  async withRemoveMember(member: PublicKey): Promise<TransactionBuilder> {
    const instruction = await this.methods
      .removeMember(member)
      .accounts({
        multisig: this.multisig.publicKey,
        multisigAuth: this.multisig.publicKey,
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  async withRemoveMemberAndChangeThreshold(
    member: PublicKey,
    threshold: number
  ): Promise<TransactionBuilder> {
    const instruction = await this.methods
      .removeMemberAndChangeThreshold(member, threshold)
      .accounts({
        multisig: this.multisig.publicKey,
        multisigAuth: this.multisig.publicKey,
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  async withChangeThreshold(threshold: number): Promise<TransactionBuilder> {
    const instruction = await this.methods
      .changeThreshold(threshold)
      .accounts({
        multisig: this.multisig.publicKey,
        multisigAuth: this.multisig.publicKey,
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  // async withAddAuthority(): Promise<TransactionBuilder> {}
  // async withSetExternalExecute(): Promise<TransactionBuilder> {}
  async withSetAsExecuted(
    programManagerPDA: PublicKey,
    managedProgramPDA: PublicKey,
    programUpgradePDA: PublicKey,
    transactionPDA: PublicKey,
    instructionPDA: PublicKey,
    authorityIndex: number
  ): Promise<TransactionBuilder> {
    const [authorityPDA] = getAuthorityPDA(
      this.multisig.publicKey,
      new BN(authorityIndex, 10),
      this.programId
    );
    const instruction = await this.managerMethods
      .setAsExecuted()
      .accounts({
        multisig: this.multisig.publicKey,
        programManager: programManagerPDA,
        managedProgram: managedProgramPDA,
        programUpgrade: programUpgradePDA,
        transaction: transactionPDA,
        instruction: instructionPDA,
        authority: authorityPDA,
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  async getInstructions(): Promise<[TransactionInstruction[], PublicKey]> {
    const transactionPDA = this.transactionPDA();
    const wrappedAddInstructions = await Promise.all(
      this.instructions.map((rawInstruction, index) =>
        this._buildAddInstruction(transactionPDA, rawInstruction, index + 1)
      )
    );
    const createTxInstruction = await this.methods
      .createTransaction(this.authorityIndex)
      .accounts({
        multisig: this.multisig.publicKey,
        transaction: transactionPDA,
        creator: this.provider.wallet.publicKey,
      })
      .instruction();
    const instructions = [createTxInstruction, ...wrappedAddInstructions];
    this.instructions = [];
    return [instructions, transactionPDA];
  }

  async getInstructionsV2({ activate }: { activate: boolean }): Promise<[TransactionInstruction[], PublicKey]> {
    const transactionPDA = this.transactionPDA();
    const createTxInstruction = await this.methods
      .createTransaction(this.authorityIndex)
      .accounts({
        multisig: this.multisig.publicKey,
        transaction: transactionPDA,
        creator: this.provider.wallet.publicKey,
      })
      .instruction();
    const wrappedAddInstructions = await this._buildAddInstructions(transactionPDA, this.instructions, activate);
    const instructions = [createTxInstruction, wrappedAddInstructions];
    this.instructions = [];
    return [instructions, transactionPDA];
  }
  async executeInstructions(): Promise<[TransactionInstruction[], PublicKey]> {
    const [instructions, transactionPDA] = await this.getInstructions();
    const { blockhash } = await this.provider.connection.getLatestBlockhash();
    const lastValidBlockHeight =
      await this.provider.connection.getBlockHeight();
    const transaction = new anchor.web3.Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: this.provider.wallet.publicKey,
    });
    transaction.add(...instructions);
    await this.provider.sendAndConfirm(transaction);
    return [instructions, transactionPDA];
  }
}
