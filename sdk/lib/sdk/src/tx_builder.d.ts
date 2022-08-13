import { MultisigAccount, SquadsMethodsNamespace } from "./types";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { AnchorProvider } from "@project-serum/anchor";
export declare class TransactionBuilder {
    multisig: MultisigAccount;
    authorityIndex: number;
    private readonly methods;
    private readonly provider;
    readonly programId: PublicKey;
    private instructions;
    constructor(methods: SquadsMethodsNamespace, provider: AnchorProvider, multisig: MultisigAccount, authorityIndex: number, programId: PublicKey, instructions?: TransactionInstruction[]);
    private _buildAddInstruction;
    private _cloneWithInstructions;
    withInstruction(instruction: TransactionInstruction): TransactionBuilder;
    withInstructions(instructions: TransactionInstruction[]): TransactionBuilder;
    withAddMember(member: PublicKey): Promise<TransactionBuilder>;
    withChangeThreshold(threshold: number): Promise<TransactionBuilder>;
    getInstructions(): Promise<[TransactionInstruction[], PublicKey]>;
}
