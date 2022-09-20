use anchor_lang::prelude::*;

#[error_code]
pub enum GraphsError {
    KeyNotInMultisig,
    InvalidTransactionState,
    InvalidNumberOfAccounts,
    InvalidInstructionAccount,
    InvalidAuthorityIndex,
    InvalidAuthorityType,
    TransactionAlreadyExecuted,
    CannotRemoveSoloMember,
    InvalidThreshold,
    DeprecatedTransaction,
    InstructionFailed,
    MaxMembersReached,
    EmptyMembers,
    PartialExecution,
    InvalidExternalAuthority
}