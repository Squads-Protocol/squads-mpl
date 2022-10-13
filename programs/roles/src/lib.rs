use anchor_lang::prelude::*;

use squads_mpl::state::{Ms, MsTransaction, MsInstruction, IncomingInstruction};
use squads_mpl::cpi::accounts::{
    CreateTransaction,
    AddInstruction,
    ActivateTransaction,
    VoteTransaction,
    ExecuteTransaction
};
use squads_mpl::program::SquadsMpl;

use state::roles::{User,Role};
pub mod state;

declare_id!("8hG7uP3qM5NKSpNnNVsiRP2YoYLA91kcwZb8CZ4U7fV2");

#[program]
pub mod roles {
    use squads_mpl::state::IncomingInstruction;

    use super::*;

    pub fn add_user(ctx: Context<NewUser>, origin_key: Pubkey, role: Role) -> Result<()> {
        let user = &mut ctx.accounts.user;
        user.init(
            origin_key,
            *ctx.bumps.get("user").unwrap(),
            role
        );
        Ok(())
    }

    pub fn create_proxy(ctx: Context<CreateProxy>, authority_index: u32) -> Result<()> {
        squads_mpl::cpi::create_transaction(ctx.accounts.create_transaction_ctx(), authority_index)
    }

    pub fn add_proxy(ctx: Context<AddProxy>, incoming_instruction: IncomingInstruction) -> Result<()> {
        squads_mpl::cpi::add_instruction(ctx.accounts.add_instruction_ctx(), incoming_instruction)
    }

    pub fn activate_proxy(ctx: Context<ActivateProxy>) -> Result<()> {
        squads_mpl::cpi::activate_transaction(ctx.accounts.activate_transaction_ctx())

    }

    pub fn execute_tx_proxy(ctx: Context<ExecuteTxProxy>, account_list: Vec<u8>) -> Result<()> {
        squads_mpl::cpi::execute_transaction(ctx.accounts.execute_transaction_ctx(), account_list)
    }
}

#[derive(Accounts)]
#[instruction(origin_key: Pubkey)]
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
    pub multisig: Box<Account<'info, Ms>>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProxy<'info> {
    #[account(mut)]
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub transaction: Account<'info, MsTransaction>,
    
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        constraint = user.origin_key == creator.key()
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,
}

impl<'info> CreateProxy<'info> {
    pub fn create_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CreateTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = CreateTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            creator: self.user.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct AddProxy<'info> {
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub instruction: Account<'info, MsInstruction>,
    
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote
    )]
    pub user: Account<'info, User>,
    
    #[account(
        mut,
        constraint = user.origin_key == creator.key()
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,
}

impl<'info> AddProxy<'info> {
    pub fn add_instruction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, AddInstruction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = AddInstruction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            instruction: self.instruction.to_account_info(),
            creator: self.user.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct ActivateProxy<'info> {
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Initiate || user.role == Role::InitiateAndExecute || user.role == Role::InitiateAndVote
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        constraint = user.origin_key == creator.key()
    )]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> ActivateProxy<'info> {
    pub fn activate_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ActivateTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = ActivateTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            creator: self.user.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct VoteProxy<'info> {
    pub multisig: Account<'info, Ms>,

    #[account(mut)]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            member.key().as_ref(),
            b"user-role"
        ], bump = user.bump,
        constraint = user.role == Role::Vote || user.role == Role::InitiateAndVote
    )]
    pub user: Account<'info, User>,

    #[account(
        mut,
        constraint = user.origin_key == member.key()
    )]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> VoteProxy<'info> {
    pub fn vote_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, VoteTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = VoteTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            member: self.user.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct ExecuteTxProxy<'info> {
    #[account(mut)]
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
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> ExecuteTxProxy<'info> {
    pub fn execute_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ExecuteTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = ExecuteTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            member: self.user.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}