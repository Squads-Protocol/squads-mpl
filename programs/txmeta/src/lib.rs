use anchor_lang::prelude::*;
declare_id!("SMPL5bz5ERMdweouWrXtk3jmb6FnjZkWf7pHDsE6Zwz");

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
