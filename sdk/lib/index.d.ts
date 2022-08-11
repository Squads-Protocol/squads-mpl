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
    static endpoint(endpoint: string, multisigProgramId?: PublicKey, programManagerProgramId?: PublicKey): Squads;
    static mainnet(multisigProgramId?: PublicKey, programManagerProgramId?: PublicKey): Squads;
    static devnet(multisigProgramId?: PublicKey, programManagerProgramId?: PublicKey): Squads;
    static localnet(multisigProgramId?: PublicKey, programManagerProgramId?: PublicKey): Squads;
}
export default Squads;
export * from "./constants";
