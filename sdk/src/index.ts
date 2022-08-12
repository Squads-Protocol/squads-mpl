import { Connection, PublicKey } from "@solana/web3.js";
import {
  DEFAULT_MULTISIG_PROGRAM_ID,
  DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
} from "./constants";
import squadsMplJSON from "../../target/idl/squads_mpl.json";
import { SquadsMpl } from "../../target/types/squads_mpl";
import programManagerJSON from "../../target/idl/program_manager.json";
import { ProgramManager } from "../../target/types/program_manager";
import { AnchorProvider, Program, Wallet } from "@project-serum/anchor";

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
    this.multisig = new Program<SquadsMpl>(
      squadsMplJSON as SquadsMpl,
      this.multisigProgramId,
      new AnchorProvider(
        this.connection,
        this.wallet,
        AnchorProvider.defaultOptions()
      )
    );
    this.programManagerProgramId =
      programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
    this.programManager = new Program<ProgramManager>(
      programManagerJSON as ProgramManager,
      this.programManagerProgramId,
      new AnchorProvider(
        this.connection,
        this.wallet,
        AnchorProvider.defaultOptions()
      )
    );
  }

  static endpoint(
    endpoint: string,
    wallet: Wallet,
    options?: {
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(endpoint),
      wallet,
      ...options,
    });
  }
  static mainnet(
    wallet: Wallet,
    options?: {
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection("https://api.mainnet-beta.solana.com"),
      wallet,
      ...options,
    });
  }
  static devnet(
    wallet: Wallet,
    options?: {
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection("https://api.devnet.solana.com"),
      wallet,
      ...options,
    });
  }
  static localnet(
    wallet: Wallet,
    options?: {
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection("http://localhost:8899"),
      wallet,
      ...options,
    });
  }

  async getMultisig() {}
  async getMultisigs() {}
  async getTransaction() {}
  async getTransactions() {}
  async getInstruction() {}
  async getInstructions() {}

  async getProgramManager() {}
  async getProgramManagers() {}
  async getManagedProgram() {}
  async getManagedPrograms() {}
  async getProgramUpgrade() {}
  async getProgramUpgrades() {}

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
