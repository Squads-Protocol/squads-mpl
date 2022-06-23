use anchor_lang::prelude::*;

#[error_code]
pub enum MsError {
    KeyNotInMultisig,
    InvalidTransactionState,
    InvalidNumberOfAccounts,
    InvalidInstructionAccount,
}