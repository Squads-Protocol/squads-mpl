/*
    Squads Multisig Program - Account contexts
    https://github.com/squads-protocol/squads-mpl
*/

use anchor_lang::prelude::*;
use crate::state::*;
use crate::errors::*;

/// The create multisig account context
/// Expects the following accounts:
/// 1. multisig account
/// 2. creator account [signer]
/// 3. system program
/// 
/// Expects the following arguments:
/// 1. threshold: u16
/// 2. create_key: Pubkey
/// 3. members: Vec<Pubkey>
/// 4. meta: String (for optional on-chain memo)
#[derive(Accounts)]
#[instruction(threshold: u16, create_key: Pubkey, members: Vec<Pubkey>, meta: String)]
pub struct Create<'info> {
    #[account(
        init,
        payer = creator,
        space = Ms::SIZE_WITHOUT_MEMBERS + (members.len() * 32),
        seeds = [b"squad", create_key.as_ref(), b"multisig"], bump
    )]
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// The account context for creating a new multisig transaction
/// Upon fresh creation the transaction will be in a Draft state
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. creator account [signer]
/// 4. system program
#[derive(Accounts)]
pub struct CreateTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        init,
        payer = creator,
        space = 8 + MsTransaction::initial_size_with_members(multisig.keys.len()),
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
            b"transaction"
        ], bump
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(creator.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// The account context for adding an instruction to a transaction
/// The transaction must be in a Draft state, and the creator must be a member of the multisig
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. instruction account
/// 4. creator account [signer]
/// 5. system program
/// 
/// Expects the following arguments:
/// 1. instruction_data: IncomingInstruction
#[derive(Accounts)]
#[instruction(instruction_data: IncomingInstruction)]
pub struct AddInstruction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.creator == creator.key(),
        constraint = transaction.status == MsTransactionStatus::Draft @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        init,
        payer = creator,
        space = 8 + instruction_data.get_max_size(),
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &transaction.instruction_index.checked_add(1).unwrap().to_le_bytes(),
            b"instruction"
        ],
        bump
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(
        mut,
        constraint = multisig.is_member(creator.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// The account context for activating a transaction
/// The transaction must be in a Draft state, and the creator must be a member of the multisig
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. creator account [signer]
/// 
#[derive(Accounts)]
pub struct ActivateTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.creator == creator.key(),
        constraint = transaction.status == MsTransactionStatus::Draft @MsError::InvalidTransactionState,
        constraint = transaction.transaction_index > multisig.ms_change_index @MsError::DeprecatedTransaction,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(creator.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub creator: Signer<'info>,
    // pub system_program: Program<'info, System>,
}

/// The account context for voting on a transaction
/// The transaction must be in an Active state, and the voter must be a member of the multisig
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. voter account [signer]
/// 
#[derive(Accounts)]
pub struct VoteTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::Active @MsError::InvalidTransactionState,
        constraint = transaction.transaction_index > multisig.ms_change_index @MsError::DeprecatedTransaction,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub member: Signer<'info>,
    // pub system_program: Program<'info, System>,
}

/// The account context for submitting a vote to cancel a transaction
/// The transaction must be in an ExecuteReady state, and the voter must be a member of the multisig
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. member account [signer]
/// 
#[derive(Accounts)]
pub struct CancelTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
}

/// The account context for executing a transaction
/// The transaction must be in an ExecuteReady state, and the creator must be a member of the multisig
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. member account [signer]
/// 
#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
        // if they've already started sequential execution, they must continue
        constraint = transaction.executed_index < 1 @MsError::PartialExecution,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub member: Signer<'info>,
}

/// The account context for executing a transaction instruction individually
/// The transaction must be in an ExecuteReady state, and the creator must be a member of the multisig, and the instruction must correlate to the next executed index
/// 
/// Expects the following accounts:
/// 1. multisig account
/// 2. transaction account
/// 3. member account [signer]
/// 
#[derive(Accounts)]
pub struct ExecuteInstruction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = transaction.ms == multisig.key() @MsError::InvalidInstructionAccount,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        mut,
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &transaction.executed_index.checked_add(1).unwrap().to_le_bytes(),
            b"instruction"
        ], bump = instruction.bump,
        // it should be the next expected instruction account to be executed
        constraint = instruction.instruction_index == transaction.executed_index.checked_add(1).unwrap() @MsError::InvalidInstructionAccount,
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(
        mut,
        constraint = multisig.is_member(member.key()).is_some() @MsError::KeyNotInMultisig,
    )]
    pub member: Signer<'info>,
}

/// The account context for executing an internal multisig transaction (which changes the multisig account)
/// 
/// Expects the following accounts:
/// 1. multisig account [signer]
#[derive(Accounts)]
pub struct MsAuth<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ], bump = multisig.bump,
        signer
    )]
    pub multisig: Box<Account<'info, Ms>>,
}

/// The account context for reallocating the multisig account (for add member, where the size may need to be adjusted)
/// 
/// Expects the following accounts:
/// 1. multisig account [signer]
/// 2. rent sysvar
/// 3. system program
/// 
/// 
#[derive(Accounts)]
pub struct MsAuthRealloc<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ], bump = multisig.bump,
        signer
    )]
    pub multisig: Box<Account<'info, Ms>>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}
