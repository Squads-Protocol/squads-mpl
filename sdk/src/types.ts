import { SquadsMpl } from "../../target/types/squads_mpl";
import { ProgramManager } from "../../target/types/program_manager";
import { AccountNamespace } from "@project-serum/anchor";

export type MultisigAccount = AccountNamespace<SquadsMpl>["ms"];
export type TransactionAccount = AccountNamespace<SquadsMpl>["msTransaction"];
export type InstructionAccount = AccountNamespace<SquadsMpl>["msInstruction"];

export type ProgramManagerAccount =
  AccountNamespace<ProgramManager>["programManager"];
export type ManagedProgramAccount =
  AccountNamespace<ProgramManager>["managedProgram"];
export type ProgramUpgradeAccount =
  AccountNamespace<ProgramManager>["programUpgrade"];
