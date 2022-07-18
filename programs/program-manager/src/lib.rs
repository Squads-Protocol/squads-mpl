use anchor_lang::prelude::*;
use state::pm::*;
use squads_mpl::state::*;
use squads_mpl::errors::*;
pub mod state;


declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod program_manager {
    use super::*;

    pub fn create_program_manager(ctx: Context<CreateManager>, bump: u8)-> Result<()>{
        let program_manager = &mut ctx.accounts.program_manager;
        program_manager.init(
            ctx.accounts.multisig.key(),
            bump
        )
    }

    pub fn create_managed_program(ctx: Context<CreateManagedProgram>, program_address: Pubkey, name: String, bump: u8)->Result<()>{
        let managed_program = &mut ctx.accounts.managed_program;
        managed_program.init(
            program_address,
            ctx.accounts.multisig.key(),
            bump,
            name,
            ctx.accounts.program_manager.managed_program_index.checked_add(1).unwrap()
        )
    }

    pub fn create_program_upgrade(ctx: Context<CreateProgramUpgrade>, ix: UpgradeInstruction, name: String, bump: u8)->Result<()>{
        let program_upgrade = &mut ctx.accounts.program_upgrade;
        program_upgrade.init(
            ctx.accounts.managed_program.key(),
            ctx.accounts.managed_program.upgrade_index.checked_add(1).unwrap(),
            ix,
            bump,
            name
        )
    }

    // pub fn close_managed_program_account() -> Result<()>{
    //     Ok(())
    // }

    // pub fn close_upgrade_account()->Result<()>{
    //     Ok(())
    // }

}

#[derive(Accounts)]
pub struct CreateManager<'info> {
    #[account(
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        init,
        payer = creator,
        space = ProgramManager::MAXIMUM_SIZE,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump
    )]
    pub program_manager: Account<'info,ProgramManager>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(program_address: Pubkey, name: String)]
pub struct CreateManagedProgram<'info> {
    #[account(
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump = program_manager.bump
    )]
    pub program_manager: Account<'info,ProgramManager>,

    #[account(
        init,
        payer = creator,
        space = ManagedProgram::MINIMUM_SIZE + name.try_to_vec().unwrap().len(),
        seeds = [
            b"squad",
            program_manager.key().as_ref(),
            &program_manager.managed_program_index.checked_add(1).unwrap().to_le_bytes(),
            b"program"
        ],
        bump
    )]
    pub managed_program: Account<'info,ManagedProgram>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}


#[derive(Accounts)]
#[instruction(ix: UpgradeInstruction, name: String)]
pub struct CreateProgramUpgrade<'info> {
    #[account(
        constraint = matches!(multisig.is_member(creator.key()), Some(..)) || multisig.allow_external_execute @MsError::KeyNotInMultisig,
    )]
    pub multisig: Account<'info, Ms>,
    
    #[account(
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            b"pmanage"
        ],
        bump = program_manager.bump
    )]
    pub program_manager: Account<'info, ProgramManager>,

    #[account(
        seeds = [
            b"squad",
            program_manager.key().as_ref(),
            &managed_program.managed_program_index.to_le_bytes(),
            b"program"
        ],
        bump = managed_program.bump
    )]
    pub managed_program: Account<'info, ManagedProgram>,

    #[account(
        init,
        payer = creator,
        space = ProgramUpgrade::MINIMUM_SIZE + ix.get_max_size() + name.try_to_vec().unwrap().len(),
        seeds = [
            b"squad",
            managed_program.key().as_ref(),
            &managed_program.upgrade_index.checked_add(1).unwrap().to_le_bytes(),
            b"pupgrade"
        ], bump
    )]
    pub program_upgrade: Account<'info, ProgramUpgrade>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}
