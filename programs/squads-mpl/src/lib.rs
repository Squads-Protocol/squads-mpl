use anchor_lang::prelude::*;

use state::ms::*;

pub mod state;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod squads_mpl {
    use super::*;
    pub fn create(ctx: Context<Create>, threshold:u16, members: Vec<Pubkey>) -> Result<()> {
        ctx.accounts.multisig.init(
            threshold,
            ctx.accounts.creator.key(),
            members,
            *ctx.bumps.get("multisig").unwrap(),
        )
    }
}

#[derive(Accounts)]
pub struct Create<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Ms::MAXIMUM_SIZE,
        seeds = [b"squad", creator.key().as_ref(), b"multisig"], bump)]
    pub multisig: Account<'info, Ms>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}


