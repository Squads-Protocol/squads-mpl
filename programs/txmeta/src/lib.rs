use anchor_lang::prelude::*;
declare_id!("SMPL5bz5ERMdweouWrXtk3jmb6FnjZkWf7pHDsE6Zwz");

#[program]
pub mod txmeta {
    use super::*;

    pub fn track_meta(_ctx: Context<Track>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(meta: String)]
pub struct Track<'info>{
    pub member: Signer<'info>,
}
