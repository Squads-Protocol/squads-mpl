use anchor_lang::prelude::*;
use squads_mpl::errors::MsError;
use squads_mpl::program::SquadsMpl;
use squads_mpl::cpi::{
    accounts::{
        CreateTransaction,
        AddInstruction,
        ActivateTransaction,
        VoteTransaction,
        ExecuteTransaction,
    }
};
use state::roles::*;
use errors::*;
pub mod errors;
pub use squads_mpl::state::ms::{Ms, MsInstruction, MsTransaction};
pub mod state;

declare_id!("8hG7uP3qM5NKSpNnNVsiRP2YoYLA91kcwZb8CZ4U7fV2");

#[program]
pub mod roles {
    use anchor_lang::solana_program::{program::invoke, system_instruction};

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
        // calculate rent for new account, and transfer funds to the role-payer
        let multisig = ctx.accounts.multisig.key();
        let user = ctx.accounts.user.key();
        let members_len = ctx.accounts.multisig.keys.len();
        let rent_needed = ctx.accounts.rent.minimum_balance(MsTransaction::initial_size_with_members(members_len)).max(1);
        let user_payer_seeds = &[
            b"squad",
            multisig.as_ref(),
            user.as_ref(),
            b"role-payer"
        ];
        let (user_payer_pda, user_payer_bump) = Pubkey::find_program_address(user_payer_seeds, ctx.program_id);

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.creator.key(),
                &user_payer_pda,
                rent_needed,
            ),
            &[
                ctx.accounts.creator.to_account_info().clone(),
                ctx.accounts.role_payer.to_account_info().clone(),
                ctx.accounts.system_program.to_account_info().clone(),
            ],
        )?;
        msg!("Transferred rent to role-payer {:?}", user_payer_pda);
        // let seeds = &[&[
            // b"squad",
            // multisig.as_ref(),
            // user.as_ref(),
            // b"role-payer",
        //     &[user_payer_bump]][..]
        // ];
        squads_mpl::cpi::create_transaction(ctx.accounts.create_transaction_ctx().with_signer(&[
            &[
                b"squad",
                multisig.as_ref(),
                user.as_ref(),
                b"role-payer",
                &[user_payer_bump],
            ],
        ]), authority_index)
    }

    pub fn add_proxy(ctx: Context<AddProxy>, incoming_instruction: IncomingInstruction) -> Result<()> {
        let multisig = ctx.accounts.multisig.key();
        let user = ctx.accounts.user.key();
        let rent_needed = ctx.accounts.rent.minimum_balance( 8 + incoming_instruction.get_max_size()).max(1);
        let user_payer_seeds = &[
            b"squad",
            multisig.as_ref(),
            user.as_ref(),
            b"role-payer"
        ];
        let (user_payer_pda, user_payer_bump) = Pubkey::find_program_address(user_payer_seeds, ctx.program_id);

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.creator.key(),
                &user_payer_pda,
                rent_needed,
            ),
            &[
                ctx.accounts.creator.to_account_info().clone(),
                ctx.accounts.role_payer.to_account_info().clone(),
                ctx.accounts.system_program.to_account_info().clone(),
            ],
        )?;
        msg!("Transferred rent to role-payer {:?}", user_payer_pda);
        squads_mpl::cpi::add_instruction(ctx.accounts.add_instruction_ctx().with_signer(&[
            &[
                b"squad",
                multisig.as_ref(),
                user.as_ref(),
                b"role-payer",
                &[user_payer_bump],
            ],
        ]), incoming_instruction.into())
    }

    pub fn activate_proxy(ctx: Context<ActivateProxy>) -> Result<()> {
        let multisig = ctx.accounts.multisig.key();
        let user = ctx.accounts.user.key();
        let user_payer_seeds = &[
            b"squad",
            multisig.as_ref(),
            user.as_ref(),
            b"role-payer"
        ];
        let (_user_payer_pda, user_payer_bump) = Pubkey::find_program_address(user_payer_seeds, ctx.program_id);
        squads_mpl::cpi::activate_transaction(ctx.accounts.activate_transaction_ctx().with_signer(&[
            &[
                b"squad",
                multisig.as_ref(),
                user.as_ref(),
                b"role-payer",
                &[user_payer_bump],
            ],
        ]))
    }

    pub fn approve_proxy(ctx: Context<VoteProxy>) -> Result<()> {
        let multisig = ctx.accounts.multisig.key();
        let user = ctx.accounts.user.key();
        let user_payer_seeds = &[
            b"squad",
            multisig.as_ref(),
            user.as_ref(),
            b"role-payer"
        ];
        let (_user_payer_pda, user_payer_bump) = Pubkey::find_program_address(user_payer_seeds, ctx.program_id);
        squads_mpl::cpi::approve_transaction(ctx.accounts.vote_transaction_ctx().with_signer(&[
            &[
                b"squad",
                multisig.as_ref(),
                user.as_ref(),
                b"role-payer",
                &[user_payer_bump],
            ],
        ]))
    }

    pub fn reject_proxy(ctx: Context<VoteProxy>) -> Result<()> {
        let multisig = ctx.accounts.multisig.key();
        let user = ctx.accounts.user.key();
        let user_payer_seeds = &[
            b"squad",
            multisig.as_ref(),
            user.as_ref(),
            b"role-payer"
        ];
        let (_user_payer_pda, user_payer_bump) = Pubkey::find_program_address(user_payer_seeds, ctx.program_id);
        squads_mpl::cpi::reject_transaction(ctx.accounts.vote_transaction_ctx().with_signer(&[
            &[
                b"squad",
                multisig.as_ref(),
                user.as_ref(),
                b"role-payer",
                &[user_payer_bump],
            ],
        ]))
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
    pub rent: Sysvar<'info, Rent>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateProxy<'info> {
    #[account(
        mut,
        owner = squads_mpl::ID,  
    )]
    pub multisig: Account<'info, Ms>,

    /// CHECK: this account gets passed through via context
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

    // #[account(
    //     seeds = [
    //         b"squad",
    //         multisig.key().as_ref(),
    //         user.key().as_ref(),
    //         b"role-payer"
    //     ], bump
    // )]
    /// CHECK: Manually checking this derivation in the method
    #[account(mut)]
    pub role_payer:  AccountInfo<'info>,

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
        msg!("TX {:?}", self.transaction.key());
        msg!("MS {:?}", self.multisig.key());
        let cpi_accounts = CreateTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            creator: self.role_payer.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct AddProxy<'info> {
    #[account(
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

    /// CHECK: Manually checking this derivation in the method
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
    pub role_payer:  AccountInfo<'info>,

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
            creator: self.role_payer.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct ActivateProxy<'info> {
    #[account(
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
    pub role_payer:  AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> ActivateProxy<'info> {
    pub fn activate_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ActivateTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = ActivateTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            creator: self.role_payer.to_account_info(),
            system_program: self.system_program.to_account_info(),
        };
        CpiContext::new(cpi_program, cpi_accounts)
    }
}

#[derive(Accounts)]
pub struct VoteProxy<'info> {
    #[account(
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
    pub role_payer:  AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub squads_program: Program<'info, SquadsMpl>,

}

impl<'info> VoteProxy<'info> {
    pub fn vote_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, VoteTransaction<'info>> {
        let cpi_program = self.squads_program.to_account_info();
        let cpi_accounts = VoteTransaction {
            multisig: self.multisig.to_account_info(),
            transaction: self.transaction.to_account_info(),
            member: self.role_payer.to_account_info(),
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