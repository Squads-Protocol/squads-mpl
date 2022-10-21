use anchor_lang::prelude::*;
declare_id!("5o4wQhxotU8rVz6iK1VowzyX53z3HuznvhvYYCMZn875");

#[program]
pub mod txmeta {
    use super::*;

    pub fn track_meta(ctx: Context<Track>, meta: String) -> Result<()> {
        let remaining = ctx.remaining_accounts;
        remaining.iter().for_each(|account| {
            msg!("Account: {:?}", account.key());
        });
        msg!("Track Meta: {:?}", meta);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Track<'info>{
    #[account(mut)]
    pub member: Signer<'info>,
}
