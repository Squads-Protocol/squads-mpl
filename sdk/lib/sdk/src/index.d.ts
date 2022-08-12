import { Connection, PublicKey } from "@solana/web3.js";
import { Wallet } from "@project-serum/anchor";
import { InstructionAccount, ManagedProgramAccount, MultisigAccount, ProgramManagerAccount, ProgramUpgradeAccount, TransactionAccount } from "./types";
declare class Squads {
    readonly connection: Connection;
    readonly wallet: Wallet;
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
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static mainnet(wallet: Wallet, options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static devnet(wallet: Wallet, options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static localnet(wallet: Wallet, options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    getMultisig(address: PublicKey): Promise<MultisigAccount>;
    getMultisigs(addresses: PublicKey[]): Promise<MultisigAccount[]>;
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
    createMultisig(): Promise<void>;
    createTransaction(): Promise<void>;
    addInstruction(): Promise<void>;
    activateTransaction(): Promise<void>;
    approveTransaction(): Promise<void>;
    rejectTransaction(): Promise<void>;
    cancelTransaction(): Promise<void>;
    executeTransaction(): Promise<void>;
    executeInstruction(): Promise<void>;
    createProgramManager(): Promise<void>;
    createManagedProgram(): Promise<void>;
    createProgramUpgrade(): Promise<void>;
    markUpgradeCompleted(): Promise<void>;
}
export default Squads;
export * from "./constants";
export * from "./address";
