import { SquadsMpl } from "../../target/types/squads_mpl";
import { ProgramManager } from "../../target/types/program_manager";
import { Idl, IdlTypes } from "@project-serum/anchor";
import { IdlTypeDef } from "@project-serum/anchor/dist/cjs/idl";
import { TypeDef } from "@project-serum/anchor/dist/cjs/program/namespace/types";
declare type TypeDefDictionary<T extends IdlTypeDef[], Defined> = {
    [K in T[number]["name"]]: TypeDef<T[number] & {
        name: K;
    }, Defined>;
};
declare type AccountDefDictionary<T extends Idl> = TypeDefDictionary<NonNullable<T["accounts"]>, IdlTypes<T>>;
export declare type MultisigAccount = AccountDefDictionary<SquadsMpl>["ms"];
export declare type TransactionAccount = AccountDefDictionary<SquadsMpl>["msTransaction"];
export declare type InstructionAccount = AccountDefDictionary<SquadsMpl>["msInstruction"];
export declare type ProgramManagerAccount = AccountDefDictionary<ProgramManager>["programManager"];
export declare type ManagedProgramAccount = AccountDefDictionary<ProgramManager>["managedProgram"];
export declare type ProgramUpgradeAccount = AccountDefDictionary<ProgramManager>["programUpgrade"];
export {};
