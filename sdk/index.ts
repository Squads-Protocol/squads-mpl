import { Connection, PublicKey } from "@solana/web3.js";
import {
  DEFAULT_MULTISIG_PROGRAM_ID,
  DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
} from "./constants";

class Squads {
  connection: Connection;
  multisigProgramId: PublicKey;
  programManagerProgramId: PublicKey;
  constructor({
    connection,
    multisigProgramId,
    programManagerProgramId,
  }: {
    connection: Connection;
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    this.connection = connection;
    this.multisigProgramId = multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID;
    this.programManagerProgramId =
      programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
  }

  static endpoint({
    endpoint,
    multisigProgramId,
    programManagerProgramId,
  }: {
    endpoint: string;
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    return new Squads({
      connection: new Connection(endpoint),
      multisigProgramId: multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID,
      programManagerProgramId:
        programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
    });
  }
  static mainnet({
    multisigProgramId,
    programManagerProgramId,
  }: {
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    return new Squads({
      connection: new Connection("https://api.mainnet-beta.solana.com"),
      multisigProgramId: multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID,
      programManagerProgramId:
        programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
    });
  }
  static devnet({
    multisigProgramId,
    programManagerProgramId,
  }: {
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    return new Squads({
      connection: new Connection("https://api.devnet.solana.com"),
      multisigProgramId: multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID,
      programManagerProgramId:
        programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
    });
  }
  static localnet({
    multisigProgramId,
    programManagerProgramId,
  }: {
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    return new Squads({
      connection: new Connection("http://localhost:8899"),
      multisigProgramId: multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID,
      programManagerProgramId:
        programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
    });
  }
}

export default Squads;

export * from "./constants";
