import { assert, expect } from "chai";
import { describe } from "mocha";
import Squads from "../src/index";
import { PublicKey } from "@solana/web3.js";

const DEFAULT_MULTISIG_PROGRAM_ID = new PublicKey(
  "SMPLecH534NA9acpos4G6x7uf3LWbCAwZQE9e8ZekMu"
);
const DEFAULT_PROGRAM_MANAGER_PROGRAM_ID = new PublicKey(
  "SMPLKTQhrgo22hFCVq2VGX1KAktTWjeizkhrdB1eauK"
);

describe("Squads SDK", () => {
  console.log("**** TESTING SQUADS SDK ****");
  describe("Basic Functionality", () => {
    it("Constructs Squads object", () => {
      const squad = Squads.localnet();
      expect(squad.connection.rpcEndpoint).to.equal("http://localhost:8899");
      assert(squad.multisigProgramId.equals(DEFAULT_MULTISIG_PROGRAM_ID));
      assert(
        squad.programManagerProgramId.equals(DEFAULT_PROGRAM_MANAGER_PROGRAM_ID)
      );
    });
  });
});
