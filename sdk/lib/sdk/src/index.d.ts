import { Connection, PublicKey } from "@solana/web3.js";
declare class Squads {
    connection: Connection;
    multisigProgramId: PublicKey;
    programManagerProgramId: PublicKey;
    constructor({ connection, multisigProgramId, programManagerProgramId, }: {
        connection: Connection;
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    });
    static endpoint(endpoint: string, options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static mainnet(options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static devnet(options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
    static localnet(options?: {
        multisigProgramId?: PublicKey;
        programManagerProgramId?: PublicKey;
    }): Squads;
}
export default Squads;
export * from "./constants";
