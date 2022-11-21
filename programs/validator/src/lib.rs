use anchor_lang::prelude::*;
use state::validator::*;
use squads_mpl::state::*;
use squads_mpl::errors::*;
pub mod state;

declare_id!("SMPLbiNbsa19gf9jz8x9uHSvSn9VLFJB38dGy46kqJ7");

#[program]
pub mod validator {

    use super::*;

    pub fn create_validator_manager(ctx: Context<CreateManager>)-> Result<()>{
        let validator_manager = &mut ctx.accounts.validator_manager;
        validator_manager.init(
            ctx.accounts.multisig.key(),
            *ctx.bumps.get("validator_manager").unwrap(),
        )
    }

    pub fn create_managed_validator(ctx: Context<CreateManagedValidator>, validator_address: Pubkey, name: String)->Result<()>{
        let managed_validator = &mut ctx.accounts.managed_validator;
        let validator_manager = &mut ctx.accounts.validator_manager;
        let new_mvi = validator_manager.managed_validator_index.checked_add(1).unwrap();
        managed_validator.init(
            validator_address,
            ctx.accounts.multisig.key(),
            *ctx.bumps.get("managed_validator").unwrap(),
            name,
            new_mvi
        )?;
        validator_manager.managed_validator_index = new_mvi;
        Ok(())
    }



}

#[derive(Accounts)]
pub struct CreateManager<'info> {
    #[account(
        owner = squads_mpl::ID,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        init,
        payer = creator,
        space = ValidatorManager::MAXIMUM_SIZE,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"vmanage"
        ],
        bump
    )]
    pub validator_manager: Account<'info,ValidatorManager>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(program_address: Pubkey, name: String)]
pub struct CreateManagedValidator<'info> {
    #[account(
        owner = squads_mpl::ID,
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"vmanage"
        ],
        bump = validator_manager.bump
    )]
    pub validator_manager: Account<'info, ValidatorManager>,

    #[account(
        init,
        payer = creator,
        space = ManagedValidator::MINIMUM_SIZE + name.try_to_vec().unwrap().len() + 4,
        seeds = [
            b"squad",
            validator_manager.key().as_ref(),
            &validator_manager.managed_validator_index.checked_add(1).unwrap().to_le_bytes(),
            b"validator"
        ],
        bump
    )]
    pub managed_validator: Account<'info,ManagedValidator>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}
