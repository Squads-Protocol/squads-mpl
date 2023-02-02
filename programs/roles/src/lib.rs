use anchor_lang::prelude::*;
use squads_mpl::errors::MsError;

use state::roles::*;
pub mod errors;
pub use squads_mpl::state::{Ms, MsInstruction, MsTransaction};
use account::*;
pub mod account;
pub mod state;

declare_id!("SMPLvKJwsyNGD6xf7Ph6VRpDGPa3DXV4uPHcTAnXe6r");

#[program]
pub mod roles {
    use anchor_lang::solana_program::{program::invoke, system_instruction};

    use super::*;

    pub fn create_manager(ctx: Context<NewManager>) -> Result<()> {
        let roles_manager = &mut ctx.accounts.roles_manager;
        roles_manager.init(ctx.accounts.multisig.key(), *ctx.bumps.get("roles_manager").unwrap())
    }

    // creates a roles account for a user, derived from the origin key
    pub fn add_user(ctx: Context<NewUser>, origin_key: Pubkey, role: Role, name: String) -> Result<()> {
        let user = &mut ctx.accounts.user;
        let roles_manager = &mut ctx.accounts.roles_manager;
        user.init(
            origin_key,
            *ctx.bumps.get("user").unwrap(),
            role,
            ctx.accounts.multisig.key(),
            roles_manager.role_index.checked_add(1).unwrap(),
            name,
        );
        roles_manager.role_index = roles_manager.role_index.checked_add(1).unwrap();
        Ok(())
    }

    // changes the role
    pub fn change_role(ctx: Context<UserModify>, role: Role) -> Result<()> {
        let user = &mut ctx.accounts.user;
        user.role = role;
        Ok(())
    }

    // creates a new transaction to be passed off to squads mpl program
    pub fn create_proxy(ctx: Context<CreateProxy>, authority_index: u32) -> Result<()> {
        let user = ctx.accounts.user.key();
        let creator = ctx.accounts.creator.key();
        // need to check and derive delegate
        let delegate_seeds = &[
            b"squad",
            user.as_ref(),
            creator.as_ref(),
            b"delegate"
        ];
        // get the delegate key
        let (delegate_pda, delegate_bump) = Pubkey::find_program_address(delegate_seeds, ctx.program_id);
        // if the supplied delegate key does not match, throw error
        if delegate_pda != ctx.accounts.delegate.key() {
            return err!(MsError::InvalidInstructionAccount);
        }
        // calculate rent for new account, and transfer funds to the role-payer
        let members_len = ctx.accounts.multisig.keys.len();
        let rent_needed = ctx.accounts.rent.minimum_balance(MsTransaction::initial_size_with_members(members_len) + 8).max(1);
        invoke(
            &system_instruction::transfer(
                &ctx.accounts.creator.key(),
                &delegate_pda,
                rent_needed,
            ),
            &[
                ctx.accounts.creator.to_account_info().clone(),
                ctx.accounts.delegate.to_account_info().clone(),
                ctx.accounts.system_program.to_account_info().clone(),
            ],
        )?;
        msg!("Post fund balance {:?}", ctx.accounts.delegate.lamports());
        squads_mpl::cpi::create_transaction(ctx.accounts.create_transaction_ctx().with_signer(&[
            &[
                b"squad",
                user.as_ref(),
                creator.as_ref(),
                b"delegate",
                &[delegate_bump],
            ],
        ]), authority_index)
    }

    // passes the instruction to be added to the squads mpl program
    pub fn add_proxy(ctx: Context<AddProxy>, incoming_instruction: IncomingInstruction) -> Result<()> {
        let user = ctx.accounts.user.key();
        let creator = ctx.accounts.creator.key();    

        // need to check and derive delegate
        let delegate_seeds = &[
            b"squad",
            user.as_ref(),
            creator.as_ref(),
            b"delegate"
        ];
        // get the delegate key
        let (delegate_pda, delegate_bump) = Pubkey::find_program_address(delegate_seeds, ctx.program_id);
        // if the supplied delegate key does not match, throw error
        if delegate_pda != ctx.accounts.delegate.key() {
            return err!(MsError::InvalidInstructionAccount);
        }

        let rent_needed = ctx.accounts.rent.minimum_balance( 8 + incoming_instruction.get_max_size()).max(1);

        invoke(
            &system_instruction::transfer(
                &ctx.accounts.creator.key(),
                &delegate_pda,
                rent_needed,
            ),
            &[
                ctx.accounts.creator.to_account_info().clone(),
                ctx.accounts.delegate.to_account_info().clone(),
                ctx.accounts.system_program.to_account_info().clone(),
            ],
        )?;
        squads_mpl::cpi::add_instruction(ctx.accounts.add_instruction_ctx().with_signer(&[
            &[
                b"squad",
                user.as_ref(),
                creator.as_ref(),
                b"delegate",
                &[delegate_bump],
            ],
        ]), incoming_instruction.into())
    }

    // activates a transaction on behalf of the user
    pub fn activate_proxy(ctx: Context<ActivateProxy>) -> Result<()> {
        let user = ctx.accounts.user.key();
        let creator = ctx.accounts.creator.key();

        // need to check and derive delegate
        let delegate_seeds = &[
            b"squad",
            user.as_ref(),
            creator.as_ref(),
            b"delegate"
        ];
        // get the delegate key
        let (delegate_pda, delegate_bump) = Pubkey::find_program_address(delegate_seeds, ctx.program_id);
        // if the supplied delegate key does not match, throw error
        if delegate_pda != ctx.accounts.delegate.key() {
            return err!(MsError::InvalidInstructionAccount);
        }
        squads_mpl::cpi::activate_transaction(ctx.accounts.activate_transaction_ctx().with_signer(&[
            &[
                b"squad",
                user.as_ref(),
                creator.as_ref(),
                b"delegate",
                &[delegate_bump],
            ],
        ]))
    }

    // approves a transaction (votes) on behalf of the user
    pub fn approve_proxy(ctx: Context<VoteProxy>) -> Result<()> {
        let user = ctx.accounts.user.key();
        let member = ctx.accounts.member.key();

        // need to check and derive delegate
        let delegate_seeds = &[
            b"squad",
            user.as_ref(),
            member.as_ref(),
            b"delegate"
        ];
        // get the delegate key
        let (delegate_pda, delegate_bump) = Pubkey::find_program_address(delegate_seeds, ctx.program_id);
        // if the supplied delegate key does not match, throw error
        if delegate_pda != ctx.accounts.delegate.key() {
            return err!(MsError::InvalidInstructionAccount);
        }
        squads_mpl::cpi::approve_transaction(ctx.accounts.vote_transaction_ctx().with_signer(&[
            &[
                b"squad",
                user.as_ref(),
                member.as_ref(),
                b"delegate",
                &[delegate_bump],
            ],
        ]))
    }

    // rejects a transaction (votes) on behalf of the user
    pub fn reject_proxy(ctx: Context<VoteProxy>) -> Result<()> {
        let user = ctx.accounts.user.key();
        let member = ctx.accounts.member.key();
        let delegate_seeds = &[
            b"squad",
            user.as_ref(),
            member.as_ref(),
            b"delegate"
        ];
        // get the delegate key
        let (delegate_pda, delegate_bump) = Pubkey::find_program_address(delegate_seeds, ctx.program_id);
        // if the supplied delegate key does not match, throw error
        if delegate_pda != ctx.accounts.delegate.key() {
            return err!(MsError::InvalidInstructionAccount);
        }
        squads_mpl::cpi::reject_transaction(ctx.accounts.vote_transaction_ctx().with_signer(&[
            &[
                b"squad",
                user.as_ref(),
                member.as_ref(),
                b"delegate",
                &[delegate_bump],
            ],
        ]))
    }

    // executes a transaction on behalf of the user
    pub fn execute_tx_proxy<'info>(ctx: Context<'_,'_,'_,'info, ExecuteTxProxy<'info>>, account_list: Vec<u8>) -> Result<()> {
        let user = ctx.accounts.user.key();
        let member = ctx.accounts.member.key();
        let delegate_seeds = &[
            b"squad",
            user.as_ref(),
            member.as_ref(),
            b"delegate"
        ];
        // get the delegate key
        let (delegate_pda, delegate_bump) = Pubkey::find_program_address(delegate_seeds, ctx.program_id);
        // if the supplied delegate key does not match, throw error
        if delegate_pda != ctx.accounts.delegate.key() {
            return err!(MsError::InvalidInstructionAccount);
        }
        let remaining_accounts = ctx.remaining_accounts.clone().to_vec();
        squads_mpl::cpi::execute_transaction(ctx.accounts.execute_transaction_ctx()
            .with_remaining_accounts(remaining_accounts)
            .with_signer(&[
                &[
                    b"squad",
                    user.as_ref(),
                    member.as_ref(),
                    b"delegate",
                    &[delegate_bump],
                ],
            ]), account_list)
    }
}