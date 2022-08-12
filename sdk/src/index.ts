import {
  Connection,
  PublicKey,
  Commitment,
  ConnectionConfig,
} from "@solana/web3.js";
import {
  DEFAULT_MULTISIG_PROGRAM_ID,
  DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
} from "./constants";
import squadsMplJSON from "../../target/idl/squads_mpl.json";
import { SquadsMpl } from "../../target/types/squads_mpl";
import programManagerJSON from "../../target/idl/program_manager.json";
import { ProgramManager } from "../../target/types/program_manager";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import { AnchorProvider, Program } from "@project-serum/anchor";
import {
  InstructionAccount,
  ManagedProgramAccount,
  MultisigAccount,
  ProgramManagerAccount,
  ProgramUpgradeAccount,
  TransactionAccount,
} from "./types";

class Squads {
  readonly connection: Connection;
  readonly wallet: Wallet;
  readonly multisigProgramId: PublicKey;
  private readonly multisig: Program<SquadsMpl>;
  readonly programManagerProgramId: PublicKey;
  private readonly programManager: Program<ProgramManager>;

  constructor({
    connection,
    wallet,
    multisigProgramId,
    programManagerProgramId,
  }: {
    connection: Connection;
    wallet: Wallet;
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    this.connection = connection;
    this.wallet = wallet;
    this.multisigProgramId = multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID;
    const provider = new AnchorProvider(
      this.connection,
      this.wallet,
      AnchorProvider.defaultOptions()
    );
    this.multisig = new Program<SquadsMpl>(
      squadsMplJSON as SquadsMpl,
      this.multisigProgramId,
      provider
    );
    this.programManagerProgramId =
      programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
    this.programManager = new Program<ProgramManager>(
      programManagerJSON as ProgramManager,
      this.programManagerProgramId,
      provider
    );
  }

  static endpoint(
    endpoint: string,
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(endpoint, options?.commitmentOrConfig),
      wallet,
      ...options,
    });
  }
  static mainnet(
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(
        "https://api.mainnet-beta.solana.com",
        options?.commitmentOrConfig
      ),
      wallet,
      ...options,
    });
  }
  static devnet(
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(
        "https://api.devnet.solana.com",
        options?.commitmentOrConfig
      ),
      wallet,
      ...options,
    });
  }
  static localnet(
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(
        "http://localhost:8899",
        options?.commitmentOrConfig
      ),
      wallet,
      ...options,
    });
  }

  async getMultisig(address: PublicKey): Promise<MultisigAccount> {
    return (await this.multisig.account.ms.fetch(address)) as MultisigAccount;
  }
  async getMultisigs(addresses: PublicKey[]): Promise<MultisigAccount[]> {
    return (await this.multisig.account.ms.fetchMultiple(
      addresses
    )) as MultisigAccount[];
  }
  async getTransaction(address: PublicKey): Promise<TransactionAccount> {
    return await this.multisig.account.msTransaction.fetch(address);
  }
  async getTransactions(
    addresses: PublicKey[]
  ): Promise<(TransactionAccount | null)[]> {
    return (await this.multisig.account.msTransaction.fetchMultiple(
      addresses
    )) as (TransactionAccount | null)[];
  }
  async getInstruction(address: PublicKey): Promise<InstructionAccount> {
    return await this.multisig.account.msInstruction.fetch(address);
  }
  async getInstructions(
    addresses: PublicKey[]
  ): Promise<(InstructionAccount | null)[]> {
    return (await this.multisig.account.msInstruction.fetchMultiple(
      addresses
    )) as (InstructionAccount | null)[];
  }

  async getProgramManager(address: PublicKey): Promise<ProgramManagerAccount> {
    return await this.programManager.account.programManager.fetch(address);
  }
  async getProgramManagers(
    addresses: PublicKey[]
  ): Promise<(ProgramManagerAccount | null)[]> {
    return (await this.programManager.account.programManager.fetchMultiple(
      addresses
    )) as (ProgramManagerAccount | null)[];
  }
  async getManagedProgram(address: PublicKey): Promise<ManagedProgramAccount> {
    return await this.programManager.account.managedProgram.fetch(address);
  }
  async getManagedPrograms(
    addresses: PublicKey[]
  ): Promise<(ManagedProgramAccount | null)[]> {
    return (await this.programManager.account.managedProgram.fetchMultiple(
      addresses
    )) as (ManagedProgramAccount | null)[];
  }
  async getProgramUpgrade(address: PublicKey): Promise<ProgramUpgradeAccount> {
    return await this.programManager.account.programUpgrade.fetch(address);
  }
  async getProgramUpgrades(
    addresses: PublicKey[]
  ): Promise<(ProgramUpgradeAccount | null)[]> {
    return (await this.programManager.account.programUpgrade.fetchMultiple(
      addresses
    )) as (ProgramUpgradeAccount | null)[];
  }

  async createMultisig() {}
  async createTransaction() {}
  async addInstruction() {}
  async activateTransaction() {}
  async approveTransaction() {}
  async rejectTransaction() {}
  async cancelTransaction() {}
  async executeTransaction() {}
  async executeInstruction() {}

  async createProgramManager() {}
  async createManagedProgram() {}
  async createProgramUpgrade() {}
  async markUpgradeCompleted() {}
}

export default Squads;

export * from "./constants";
export * from "./address";
