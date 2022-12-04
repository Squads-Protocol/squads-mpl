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
    #[msg("Number of instruction arguments does not match number of instruction accounts.")]
    InvalidInstructionCount,
    InvalidAccount,
}