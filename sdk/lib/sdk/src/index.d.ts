import { Connection, PublicKey, Commitment, ConnectionConfig, TransactionInstruction } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import { InstructionAccount, ManagedProgramAccount, MultisigAccount, ProgramManagerAccount, ProgramUpgradeAccount, TransactionAccount } from "./types";
declare class Squads {
    readonly connection: Connection;
    readonly wallet: Wallet;
    private readonly provider;
    readonly multisigProgramId: PublicKey;
    private readonly multisig;
    readonly programManagerProgramId: PublicKey;
    private readonly programManager;
    constructor({ connection, wallet, multisigProgramId, programManagerProgramId, }: {
        connection: Connection;
        wallet: Wallet;
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    });
    static endpoint(endpoint: string, wallet: Wallet, options?: {
        commitmentOrConfig?: Commitment | ConnectionConfig;
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static mainnet(wallet: Wallet, options?: {
        commitmentOrConfig?: Commitment | ConnectionConfig;
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static devnet(wallet: Wallet, options?: {
        commitmentOrConfig?: Commitment | ConnectionConfig;
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static localnet(wallet: Wallet, options?: {
        commitmentOrConfig?: Commitment | ConnectionConfig;
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    private _addPublicKeys;
    getMultisig(address: PublicKey): Promise<MultisigAccount>;
    getMultisigs(addresses: PublicKey[]): Promise<(MultisigAccount | null)[]>;
    getTransaction(address: PublicKey): Promise<TransactionAccount>;
    getTransactions(addresses: PublicKey[]): Promise<(TransactionAccount | null)[]>;
    getInstruction(address: PublicKey): Promise<InstructionAccount>;
    getInstructions(addresses: PublicKey[]): Promise<(InstructionAccount | null)[]>;
    getProgramManager(address: PublicKey): Promise<ProgramManagerAccount>;
    getProgramManagers(addresses: PublicKey[]): Promise<(ProgramManagerAccount | null)[]>;
    getManagedProgram(address: PublicKey): Promise<ManagedProgramAccount>;
    getManagedPrograms(addresses: PublicKey[]): Promise<(ManagedProgramAccount | null)[]>;
    getProgramUpgrade(address: PublicKey): Promise<ProgramUpgradeAccount>;
    getProgramUpgrades(addresses: PublicKey[]): Promise<(ProgramUpgradeAccount | null)[]>;
    getNextTransactionIndex(multisigPDA: PublicKey): Promise<number>;
    getNextInstructionIndex(transactionPDA: PublicKey): Promise<number>;
    getNextProgramIndex(programManagerPDA: PublicKey): Promise<number>;
    getNextUpgradeIndex(managedProgramPDA: PublicKey): Promise<number>;
    createMultisig(threshold: number, createKey: PublicKey, initialMembers: PublicKey[]): Promise<MultisigAccount>;
    createTransaction(multisigPDA: PublicKey, authorityIndex: number): Promise<TransactionAccount>;
    addInstruction(transactionPDA: PublicKey, instruction: TransactionInstruction): Promise<InstructionAccount>;
    activateTransaction(transactionPDA: PublicKey): Promise<TransactionAccount>;
    approveTransaction(transactionPDA: PublicKey): Promise<TransactionAccount>;
    rejectTransaction(transactionPDA: PublicKey): Promise<TransactionAccount>;
    cancelTransaction(transactionPDA: PublicKey): Promise<TransactionAccount>;
    executeTransaction(transactionPDA: PublicKey, feePayer?: Wallet): Promise<TransactionAccount>;
    executeInstruction(transactionPDA: PublicKey, instructionPDA: PublicKey): Promise<InstructionAccount>;
    createProgramManager(): Promise<void>;
    createManagedProgram(): Promise<void>;
    createProgramUpgrade(): Promise<void>;
    markUpgradeCompleted(): Promise<void>;
}
export default Squads;
export * from "./constants";
export * from "./address";
