use anchor_lang::prelude::*;
use squads_mpl::state::{Ms, MsTransaction};
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

    #[account(constraint = transaction.to_account_info().owner == &squads_mpl::ID @ ErrorCode::InvalidOwner)]
    pub transaction: Account<'info, MsTransaction>,
}

impl<'info> Track<'info> {
    fn validate(ctx: &Context<Track>) -> Result<()> {
        let multisig = &ctx.accounts.multisig;
        let signer = &ctx.accounts.member;
        let transaction = &ctx.accounts.transaction;

        // Check to make sure that the signer is a member of the supplied [squads_mpl::state::Ms] account
        match multisig.is_member(signer.key()) {
            Some(_) => {
                // Check to make sure the signer is the creator of the supplied [squads_mpl::state::MsTransaction] account
                // and that the transaction comes from the supplied [squads_mpl::state::Ms] account
                if transaction.creator == signer.key() && transaction.ms == multisig.key() {
                    return Ok(());
                };
                return err!(ErrorCode::InvalidTransaction);
            }
            None => err!(ErrorCode::Unauthorized),
        }
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("Signer is not a member of the specified multisig.")]
    Unauthorized,
    #[msg("The owner of the account is not the expected program.")]
    InvalidOwner,
    #[msg("The transaction is either not associated with the supplied multisig or it's creator is not the supplied signer")]
    InvalidTransaction,
}
