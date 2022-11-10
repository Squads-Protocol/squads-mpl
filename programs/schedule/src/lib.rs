use anchor_lang::prelude::*;
use anchor_lang::solana_program::borsh::get_instance_packed_len;
use clockwork_thread_program::cpi::accounts::ThreadUpdate;
use clockwork_thread_program::program::ThreadProgram;
use clockwork_thread_program::cpi::thread_update;
use squads_mpl::program::SquadsMpl;
// use clockwork_thread_program::thread_program::ThreadProgram;
use squads_mpl::cpi::{
    accounts::{
        CreateTransaction,
        AddInstruction,
        ActivateTransaction,
    }
};
use squads_mpl::state::{IncomingInstruction, Ms, MsTransaction, MsInstruction};
use clockwork_thread_program::objects::{Thread, InstructionData, AccountMetaData};
use hex::FromHex;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod schedule {
    use clockwork_thread_program::objects::ThreadSettings;

    use super::*;

    // creates a schedule account
    pub fn create_schedule(ctx: Context<CreateSchedule>, ix: IncomingInstruction, authority_index: u32) -> Result<()> {
        let schedule = &mut ctx.accounts.schedule;
        let ms = &ctx.accounts.multisig;
        // write the init schedule data for the newly created schedule account
        schedule.init(
            ix,
            ms.key(),
            authority_index,
            ms.transaction_index.checked_add(1).unwrap(),
            *ctx.bumps.get("schedule").unwrap(),
            ctx.accounts.creator.key(),
        )
    }

    // to do?, the thread needs to be owned by the scheduled instruction pda
    // pub fn create_thread() -> Result<()> {
    //     Ok(())
    // }

    // pub fn delete_thread() -> Result<()> {
    //     Ok(())
    // }

    // updates the transaction index with the multisig account changes - should be triggered on account change (thread needed for this?)
    pub fn sync_schedule(ctx: Context<SyncSchedule>) -> Result<()> {
        let schedule = &mut ctx.accounts.schedule;
        let ms = &ctx.accounts.multisig;
        
        schedule.transaction_index = ms.transaction_index;
        Ok(())
    }

    // updates the thread account instruction to update the tx and ix accounts to be used during invocation
    pub fn sync_thread(ctx: Context<SyncThread>) -> Result<()> {
        let thread = &mut ctx.accounts.thread;
        let schedule = &ctx.accounts.schedule;
        let (tx, _tx_bump) = Pubkey::find_program_address(&[
            b"squad",
            schedule.ms.key().as_ref(),
            &schedule.transaction_index.checked_add(1).unwrap().to_le_bytes(),
            b"transaction"], 
        &squads_mpl::ID);

        let (ix, _ix_bump) = Pubkey::find_program_address(&[
            b"squad",
            tx.as_ref(),
            &1_u8.to_le_bytes(),
            b"instruction"],
            &squads_mpl::ID);

        let accounts: Vec<AccountMetaData> = schedule.ix.keys.iter().enumerate().map(|(i,k)| 
            AccountMetaData {
                pubkey: match i { 1 => tx, 2=> ix, _ => k.pubkey},
                is_signer: k.is_signer,
                is_writable: k.is_writable,
            }
        ).collect();

        // will have to invoke the thread program of clockwork to update
        let kickoff_instruction = InstructionData {
            program_id: *ctx.program_id,
            accounts: accounts.clone(),
            data: Vec::from_hex("d5aad06f588d17e8").unwrap(),   //kickoff for execute_schedule discrim
        };
        let thread_settings = ThreadSettings {
            fee: Some(thread.fee),
            kickoff_instruction: Some(kickoff_instruction),
            rate_limit: Some(thread.rate_limit),
            trigger: Some(thread.trigger.clone()),
        };

        // update the thread via cpi
        thread_update(ctx.accounts.update_thread_ctx(), thread_settings)
    }

    // the instruction to be executed by the actual thread
    pub fn execute_schedule(ctx: Context<ExecuteSchedule>) -> Result<()> {
        let schedule = &ctx.accounts.schedule;
        
        squads_mpl::cpi::create_transaction(ctx.accounts.create_transaction_ctx(), schedule.authority_index)?;
        squads_mpl::cpi::add_instruction(ctx.accounts.add_instruction_ctx(), schedule.ix.clone())?;
        squads_mpl::cpi::activate_transaction(ctx.accounts.activate_transaction_ctx())?;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct SyncSchedule<'info> {
    pub multisig: Account<'info, Ms>,
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            schedule.owner.key().as_ref(),
            b"scheduled-instruction"
        ],
        bump = schedule.bump,
    )]
    pub schedule: Account<'info, ScheduledInstruction>,
}

#[derive(Accounts)]
pub struct SyncThread<'info> {
    pub schedule: Account<'info, ScheduledInstruction>,
    #[account(mut)]
    pub thread: Account<'info, Thread>,
    pub system_program: Program<'info, System>,
    pub clockwork_program: Program<'info, ThreadProgram>,
}

impl <'info> SyncThread<'info> {
    pub fn update_thread_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ThreadUpdate<'info>> {

        CpiContext::new(
            self.clockwork_program.to_account_info(),
            ThreadUpdate {
                authority: self.schedule.to_account_info(),
                system_program: self.system_program.to_account_info(),
                thread: self.thread.to_account_info(),
            }
        )
    }
}

#[derive(Accounts)]
pub struct ExecuteSchedule<'info> {
    pub multisig: Account<'info, Ms>,
    #[account(mut)]
    pub transaction: Account<'info, MsTransaction>,
    #[account(mut)]
    pub instruction: Account<'info, MsInstruction>,
    #[account(mut)]
    pub schedule: Account<'info, ScheduledInstruction>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub squads_program: Program<'info, SquadsMpl>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(ix: IncomingInstruction)]
pub struct CreateSchedule<'info> {
    #[account(
        init,
        payer = creator,
        space = ScheduledInstruction::MINIMUM_SIZE + get_instance_packed_len(&ix).unwrap(),
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            creator.key().as_ref(),
            b"scheduled-instruction"
        ], 
        bump
    )]
    pub schedule: Account<'info, ScheduledInstruction>,
    pub multisig: Account<'info, Ms>,
    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

impl<'info> ExecuteSchedule<'info> {
    pub fn create_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, CreateTransaction<'info>> {
        CpiContext::new(
            self.squads_program.to_account_info(),
            CreateTransaction {
                multisig: self.multisig.to_account_info(),
                transaction: self.transaction.to_account_info(),
                creator: self.creator.to_account_info(),
                system_program: self.system_program.to_account_info(),
            },
        )
    }

    pub fn add_instruction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, AddInstruction<'info>> {
        CpiContext::new(
            self.squads_program.to_account_info(),
            AddInstruction {
                creator: self.creator.to_account_info(),
                multisig: self.multisig.to_account_info(),
                transaction: self.transaction.to_account_info(),
                instruction: self.instruction.to_account_info(),
                system_program: self.system_program.to_account_info(),
            },
        )
    }

    pub fn activate_transaction_ctx(&self) -> CpiContext<'_, '_, '_, 'info, ActivateTransaction<'info>> {
        CpiContext::new(
            self.squads_program.to_account_info(),
            ActivateTransaction {
                creator: self.creator.to_account_info(),
                multisig: self.multisig.to_account_info(),
                transaction: self.transaction.to_account_info(),
                system_program: self.system_program.to_account_info(),
            },
        )
    }
}

#[account]
pub struct ScheduledInstruction {
    ix: IncomingInstruction,    // the data that will be used to send to the add_instruction cpi
    transaction_index: u32,     // the synced current ms transaction index
    ms: Pubkey,                 // the multisig this tracks
    bump: u8,                   // the bump of the schedule
    authority_index: u32,       // the authority index to use for this schedule
    owner: Pubkey,          // the authority to use for this schedule
}

impl ScheduledInstruction {
    pub fn init(&mut self, ix: IncomingInstruction, ms: Pubkey, authority_index: u32, transaction_index: u32, bump: u8, owner: Pubkey) -> Result<()> {
        self.ix = ix;
        self.transaction_index = transaction_index;
        self.ms = ms;
        self.bump = bump;
        self.authority_index = authority_index;
        self.owner = owner;
        Ok(())
    }
    pub const MINIMUM_SIZE: usize = 8 + // discriminator
        4 + // tx index
        32 + // ms pubkey
        1 + //bump 
        32 + // owner
        4; //authority index
}