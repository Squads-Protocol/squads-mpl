import { MultisigAccount, SquadsMethodsNamespace } from "./types";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { getIxPDA, getTxPDA } from "./address";
import BN from "bn.js";
import { AnchorProvider } from "@project-serum/anchor";

export class TransactionBuilder {
  multisig: MultisigAccount;
  authorityIndex: number;
  private readonly methods: SquadsMethodsNamespace;
  private readonly provider: AnchorProvider;
  readonly programId: PublicKey;
  private instructions: TransactionInstruction[];
  constructor(
    methods: SquadsMethodsNamespace,
    provider: AnchorProvider,
    multisig: MultisigAccount,
    authorityIndex: number,
    programId: PublicKey,
    instructions?: TransactionInstruction[]
  ) {
    this.methods = methods;
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
  private _cloneWithInstructions(
    instructions: TransactionInstruction[]
  ): TransactionBuilder {
    return new TransactionBuilder(
      this.methods,
      this.provider,
      this.multisig,
      this.authorityIndex,
      this.programId,
      instructions
    );
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
      })
      .instruction();
    return this.withInstruction(instruction);
  }
  // async withAddMemberAndChangeThreshold(): Promise<TransactionBuilder> {}
  // async withRemoveMember(): Promise<TransactionBuilder> {}
  // async withRemoveMemberAndChangeThreshold(): Promise<TransactionBuilder> {}
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
  async getInstructions(): Promise<[TransactionInstruction[], PublicKey]> {
    const [transactionPDA] = getTxPDA(
      this.multisig.publicKey,
      new BN(this.multisig.transactionIndex + 1),
      this.programId
    );
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
    return [instructions, transactionPDA];
  }
}
