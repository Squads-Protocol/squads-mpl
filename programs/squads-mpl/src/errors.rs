/*
    Squads Multisig Program - Program Errors
    https://github.com/squads-protocol/squads-mpl
*/

use anchor_lang::prelude::*;

#[error_code]
pub enum MsError {
    KeyNotInMultisig,
    InvalidTransactionState,
    InvalidNumberOfAccounts,
    InvalidInstructionAccount,
    InvalidAuthorityIndex,
    TransactionAlreadyExecuted,
    CannotRemoveSoloMember,
    InvalidThreshold,
    DeprecatedTransaction,
    InstructionFailed,
    MaxMembersReached,
    EmptyMembers,
    PartialExecution,
    NotEnoughLamports,
}