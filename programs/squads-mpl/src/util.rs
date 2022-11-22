use anchor_lang::prelude::*;
use anchor_lang::solana_program::program::invoke_signed;
use anchor_lang::solana_program::system_instruction;
use anchor_lang::system_program;

pub struct InitPdaArgs<'a, 'b, 'info> {
    /// CHECK: heheh
    pub account_info: AccountInfo<'info>,
    /// CHECK: hehehe
    pub payer: AccountInfo<'info>,
    pub space: usize,
    // pub seeds: &'b [&'b [u8]],
    pub seeds_with_bump: &'b [&'b [u8]],
    // pub bump: u8,
    pub owner: &'a Pubkey,
    /// CHECK: HAHAHAHAH
    pub system_program: AccountInfo<'info>,
}

/// Initializes a new PDA account.
///
/// It's partially copied from the Anchor repository:
/// https://github.com/coral-xyz/anchor/blob/8ce18c36db10c6cb7a342e38ed7b5740bfa61c58/lang/syn/src/codegen/accounts/constraints.rs#L816
pub fn init_pda(args: InitPdaArgs) -> Result<()> {
    let rent = Rent::get()?;
    let rent_exemption_lamports = rent.minimum_balance(args.space);
    // let seeds_with_bump = [&args.seeds[..], &[&[args.bump]]];

    // let seeds_with_bump [
    //     b"squad" as &[u8],
    //     &tx_key.as_ref(),
    //     &tx.instruction_index.to_le_bytes(),
    //     b"instruction"
    // ];

    let current_lamports = args.account_info.lamports();
    msg!("Initializing the account data for {:?}", args.account_info);
    msg!("PAYER {:?}", args.payer);
    let payer = args.payer.clone();
    let new_account = args.account_info.clone();
    if current_lamports == 0 {
        // Create the token account with right amount of lamports and space, and the correct owner.
        // let cpi_accounts = system_program::CreateAccount {
        //     from: args.payer,
        //     to: args.account_info,
        // };

        // let cpi_context = CpiContext::new(args.system_program.to_account_info(), cpi_accounts);
        // msg!("CPI CONTEXT {:?}", cpi_context);
        // system_program::create_account(
        //     cpi_context.with_signer(&seeds_with_bump),
        //     rent_exemption_lamports,
        //     args.space as u64,
        //     args.owner
        // )?;

        invoke_signed(
            &system_instruction::create_account(
                payer.key,
                new_account.key,
                rent_exemption_lamports,
                args.space as u64,
                args.owner,
            ),
            &[
                payer,
                new_account,
                args.system_program
            ],
            &[args.seeds_with_bump]
        )?;
    } else {
        // Fund the account for rent exemption.
        let required_lamports = rent_exemption_lamports.max(1).saturating_sub(current_lamports);
        if required_lamports > 0 {
            let cpi_accounts = system_program::Transfer {
                from: args.payer.to_account_info(),
                to: args.account_info.to_account_info(),
            };
            let cpi_context = CpiContext::new(args.system_program.to_account_info(), cpi_accounts);
            system_program::transfer(cpi_context, required_lamports)?;
        }
        // Allocate space.
        let cpi_accounts = system_program::Allocate {
            account_to_allocate: args.account_info.to_account_info()
        };
        let cpi_context = CpiContext::new(args.system_program.to_account_info(), cpi_accounts);
        system_program::allocate(cpi_context.with_signer(&[args.seeds_with_bump]), args.space as u64)?;
        // Assign to the spl token program.
        let cpi_accounts = system_program::Assign {
            account_to_assign: args.account_info.to_account_info()
        };
        let cpi_context = CpiContext::new(args.system_program.to_account_info(), cpi_accounts);
        system_program::assign(cpi_context.with_signer(&[args.seeds_with_bump]), args.owner)?;
    }

    Ok(())
}