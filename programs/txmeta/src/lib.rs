use anchor_lang::prelude::*;
use squads_mpl::state::Ms;
declare_id!("SMPL5bz5ERMdweouWrXtk3jmb6FnjZkWf7pHDsE6Zwz");

#[program]
pub mod txmeta {
    use super::*;

    #[access_control(Track::validate(&ctx))]
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
pub struct Track<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(constraint = multisig.to_account_info().owner == &squads_mpl::ID @ ErrorCode::InvalidOwner)]
    pub multisig: Account<'info, Ms>,
}

impl<'info> Track<'info> {
    /// Check to make sure that the signer is a member of the supplied [squads_mpl::state::Ms] account
    fn validate(ctx: &Context<Track>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let signer = &ctx.accounts.member;

        match multisig.is_member(signer.key()) {
            Some(_) => Ok(()),
            None => Err(ErrorCode::Unauthorized.into()),
        }
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Signer is not a member of the specified multisig.")]
    Unauthorized,
    #[msg("The owner of the multisig account is not the expected program.")]
    InvalidOwner,
}
