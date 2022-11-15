use anchor_lang::prelude::*;
use squads_mpl::{state::{Ms, MsTransaction}, errors::MsError, program::SquadsMpl};
use squads_mpl::cpi::{
    accounts::{
        CreateTransaction,
        AddInstruction,
        ActivateTransaction,
        VoteTransaction,
        ExecuteTransaction,
    }
};

use crate::errors::RolesError;
use crate::state::roles::*;

#[derive(Accounts)]
#[instruction(origin_key: Pubkey, role: Role)]
pub struct NewUser<'info>{
    #[account(
        init,
        payer = payer,
        space = 8 + User::MAXIMUM_SIZE,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            origin_key.as_ref(),
            b"user-role"
        ], bump
    )]
    pub user:  Box<Account<'info, User>>,

    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(
        mut,
        constraint = matches!(multisig.is_member(payer.key()), Some(..)) @MsError::KeyNotInMultisig,
    )]
    pub payer: Signer<'info>,

    // the authority of the squad will only sign if this
    // is part of a typical squads transaction (will be screen appropriately by the SMPL)
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.authority_index.to_le_bytes(),
            b"authority",
        ],
        bump = transaction.authority_bump,
        seeds::program = squads_mpl::ID,
    )]
    pub authority: Signer<'info>,

    // this will link to the relevant authority above, and imply that it is
    // part of a squads transaction
    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ],
        bump = transaction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub transaction: Account<'info, MsTransaction>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct UserModify<'info>{
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            user.origin_key.as_ref(),
            b"user-role"
        ], bump = user.bump,
    )]
    pub user:  Box<Account<'info, User>>,

    #[account(
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(
        mut,
        constraint = matches!(multisig.is_member(payer.key()), Some(..)) @MsError::KeyNotInMultisig,
    )]
    pub payer: Signer<'info>,

    // the authority of the squad will only sign if this
    // is part of a typical squads transaction (will be screen appropriately by the SMPL)
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.authority_index.to_le_bytes(),
            b"authority",
        ],
        bump = transaction.authority_bump,
        seeds::program = squads_mpl::ID,
    )]
    pub authority: Signer<'info>,

    // this will link to the relevant authority above, and imply that it is
    // part of a squads transaction
    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ],
        bump = transaction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub transaction: Account<'info, MsTransaction>,

    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProxy<'info> {
    #[account(
        mut,
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Account<'info, Ms>,

    /// CHECK: this account gets passed through via context and the Squads MPL program will proceed with relevant checks
    #[account(mut)]
    pub transaction: AccountInfo<'info>,
    
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote @RolesError::InvalidRole
    )]
    pub user: Account<'info, User>,

    /// CHECK: Manually checking this derivation in the create_proxy function above
    #[account(mut)]
    pub delegate:  AccountInfo<'info>,

    #[account(
        mut,
        constraint = user.origin_key == creator.key() @MsError::InvalidInstructionAccount
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> CreateProxy<'info> {
    pub fn create_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CreateTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = CreateTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            creator: self.delegate.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct AddProxy<'info> {
    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ],
        bump = transaction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub transaction: Account<'info, MsTransaction>,

    /// CHECK: instruction account is passed through and verified via the SMPL program
    #[account(mut)]
    pub instruction: AccountInfo<'info>,
    
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote @RolesError::InvalidRole
    )]
    pub user: Account<'info, User>,

    /// CHECK: Manually checking this derivation in the method
    #[account(mut)]
    pub delegate:  AccountInfo<'info>,

    #[account(
        mut,
        constraint = user.origin_key == creator.key()
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> AddProxy<'info> {
    pub fn add_instruction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, AddInstruction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = AddInstruction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            instruction: self.instruction.to_account_info(),
            creator: self.delegate.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct ActivateProxy<'info> {
    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ],
        bump = transaction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote @RolesError::InvalidRole
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        constraint = user.origin_key == creator.key()
    )]
    pub creator: Signer<'info>,
    /// CHECK: Manually checking this derivation in the method
    #[account(mut)]
    pub delegate:  AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> ActivateProxy<'info> {
    pub fn activate_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ActivateTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = ActivateTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            creator: self.delegate.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct VoteProxy<'info> {
    #[account(
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        owner = squads_mpl::ID,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ],
        bump = transaction.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            member.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Vote || user.role == Role::InitiateAndVote @RolesError::InvalidRole
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        constraint = user.origin_key == member.key()
    )]
    pub member: Signer<'info>,
    /// CHECK: Manually checking this derivation in the method
    #[account(mut)]
    pub delegate:  AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> VoteProxy<'info> {
    pub fn vote_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, VoteTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = VoteTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            member: self.delegate.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct ExecuteTxProxy<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.create_key.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
        seeds::program = squads_mpl::ID,
    )]
    pub multisig: Box<Account<'info, Ms>>,

    #[account(mut)]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            member.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Execute || user.role == Role::InitiateAndExecute,
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        constraint = user.origin_key == member.key()
    )]
    pub member: Signer<'info>,
    /// CHECK: Manually checking this derivation in the method
    #[account(mut)]
    pub delegate:  AccountInfo<'info>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> ExecuteTxProxy<'info> {
    pub fn execute_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ExecuteTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = ExecuteTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            member: self.delegate.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}