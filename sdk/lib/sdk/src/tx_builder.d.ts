import { MultisigAccount, ProgramManagerMethodsNamespace, SquadsMethodsNamespace } from "./types";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
export declare class TransactionBuilder {
    multisig: MultisigAccount;
    authorityIndex: number;
    private readonly methods;
    private readonly managerMethods;
    private readonly provider;
    readonly programId: PublicKey;
    private instructions;
    constructor(methods: SquadsMethodsNamespace, managerMethods: ProgramManagerMethodsNamespace, provider: AnchorProvider, multisig: MultisigAccount, authorityIndex: number, programId: PublicKey, instructions?: TransactionInstruction[]);
    private _buildAddInstruction;
    private _cloneWithInstructions;
    transactionPDA(): PublicKey;
    withInstruction(instruction: TransactionInstruction): TransactionBuilder;
    withInstructions(instructions: TransactionInstruction[]): TransactionBuilder;
    withAddMember(member: PublicKey): Promise<TransactionBuilder>;
    withAddMemberAndChangeThreshold(member: PublicKey, threshold: number): Promise<TransactionBuilder>;
    withRemoveMember(member: PublicKey): Promise<TransactionBuilder>;
    withRemoveMemberAndChangeThreshold(member: PublicKey, threshold: number): Promise<TransactionBuilder>;
    withChangeThreshold(threshold: number): Promise<TransactionBuilder>;
    withSetAsExecuted(programManagerPDA: PublicKey, managedProgramPDA: PublicKey, programUpgradePDA: PublicKey, transactionPDA: PublicKey, instructionPDA: PublicKey, authorityIndex: number): Promise<TransactionBuilder>;
    getInstructions(): Promise<[TransactionInstruction[], PublicKey]>;
    executeInstructions(): Promise<[TransactionInstruction[], PublicKey]>;
}
