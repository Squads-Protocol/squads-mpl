use anchor_lang::prelude::*;
use anchor_lang::system_program;

use super::errors::*;

pub struct InitArgs<'info> {
    pub account_info: AccountInfo<'info>,
    pub payer: AccountInfo<'info>,
    pub space: usize,
    pub seeds: &'info [&'info [u8]],
    pub bump: u8,
    pub owner: &'info Pubkey,
    pub system_program: AccountInfo<'info>,
}

/// Initializes a new account.
///
/// It's partially copied from the Anchor repository:
/// https://github.com/coral-xyz/anchor/blob/8ce18c36db10c6cb7a342e38ed7b5740bfa61c58/lang/syn/src/codegen/accounts/constraints.rs#L816
pub fn init_pda<T>(args: InitArgs) -> Result<()> {
    let current_lamports = args.account_info.lamports();

    // If the account being initialized already has lamports throw an error.
    require_eq!(current_lamports, 0, MsError::AccountHasLamports);

    // Create the token account with right amount of lamports and space, and the correct owner.
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(args.space);
    let cpi_accounts = system_program::CreateAccount {
        from: args.payer.to_account_info(),
        to: args.account_info.to_account_info()
    };
    let cpi_context = CpiContext::new(args.system_program.to_account_info(), cpi_accounts);
    let seeds_with_bump = [&args.seeds[..], &[&[args.bump]]];
    system_program::create_account(
        cpi_context.with_signer(&seeds_with_bump),
        lamports,
        args.space as u64,
        args.owner
    )?;

    Ok(())
}