use anchor_lang::{prelude::*, solana_program::instruction::Instruction};

use state::ms::*;
pub mod state;

use errors::*;
pub mod errors;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod squads_mpl {
    use anchor_lang::solana_program::program::invoke_signed;

    use super::*;
    pub fn create(ctx: Context<Create>, threshold:u16, members: Vec<Pubkey>) -> Result<()> {
        ctx.accounts.multisig.init(
            threshold,
            ctx.accounts.creator.key(),
            members,
            *ctx.bumps.get("multisig").unwrap(),
        )
    }

    pub fn create_transaction(ctx: Context<CreateTransaction>, authority_index: u32) -> Result<()> {
        let ms = &mut ctx.accounts.multisig;
        let (authority_pda, authority_bump) = Pubkey::find_program_address(&[
            b"squad",
            ms.key().as_ref(),
            &authority_index.to_le_bytes(),
            b"authority"
        ], ctx.program_id);

        ms.transaction_index =  ms.transaction_index.checked_add(1).unwrap();
        ctx.accounts.transaction.init(
            ctx.accounts.creator.key(),
            ms.transaction_index,
            *ctx.bumps.get("transaction").unwrap(),
            authority_index,
            authority_bump,
        )
    }

    pub fn activate_transaction(ctx: Context<ActivateTransaction>) -> Result<()> {
        ctx.accounts.transaction.activate()
    }

    pub fn add_instruction(ctx: Context<AddInstruction>, incoming_instruction: IncomingInstruction) -> Result<()> {
        let tx = &mut ctx.accounts.transaction;
        tx.instruction_index = tx.instruction_index.checked_add(1).unwrap();
        ctx.accounts.instruction.init(
            tx.instruction_index,
            incoming_instruction,
            *ctx.bumps.get("instruction").unwrap()
        )
    }

    // sign/approve the transaction
    pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
        // if they have previously voted to reject, remove that item (change vote check)
        match ctx.accounts.transaction.has_voted_reject(ctx.accounts.member.key()) {
            Some(ind) => ctx.accounts.transaction.remove_reject(ind)?,
            _ => {}
         };

        // if they haven't already approved
        match ctx.accounts.transaction.has_voted_approve(ctx.accounts.member.key()) {
           None => ctx.accounts.transaction.sign(ctx.accounts.member.key())?,
          _ => {}
        };

        // if current number of signers reaches threshold, mark the transaction as execute ready
        if ctx.accounts.transaction.approved.len() >= usize::from(ctx.accounts.multisig.threshold) {
            ctx.accounts.transaction.ready_to_execute()?;
        }
        Ok(())
    }
    
    // reject the transaction
    pub fn reject_transaction(ctx: Context<RejectTransaction>) -> Result<()> {
        // if they have previously voted to approve, remove that item (change vote check)
        match ctx.accounts.transaction.has_voted_approve(ctx.accounts.member.key()) {
            Some(ind) => ctx.accounts.transaction.remove_approve(ind)?,
            None => {}
         };

        match ctx.accounts.transaction.has_voted_reject(ctx.accounts.member.key()) {
            None => ctx.accounts.transaction.reject(ctx.accounts.member.key())?,
            _=> {}
        };

        // ie total members 7, threshold 3, cutoff = 4
        // ie total member 8, threshold 6, cutoff = 2
        let cutoff = ctx.accounts.multisig.keys.len().checked_sub(usize::from(ctx.accounts.multisig.threshold)).unwrap();
        if ctx.accounts.transaction.rejected.len() > cutoff {
            ctx.accounts.transaction.set_rejected()?;
        }
        Ok(())
    }

    // cancel the transaction
    pub fn cancel_transaction(ctx: Context<CancelTransaction>) -> Result<()> {
        match ctx.accounts.transaction.has_cancelled(ctx.accounts.member.key()) {
            None => ctx.accounts.transaction.cancel(ctx.accounts.member.key())?,
           _ => {}
        };

        // if current number of signers reaches threshold, mark the transaction as execute ready
        if ctx.accounts.transaction.cancelled.len() >= usize::from(ctx.accounts.multisig.threshold) {
            ctx.accounts.transaction.set_cancelled()?;
            ctx.accounts.multisig.set_processed_index(ctx.accounts.transaction.transaction_index)?;
        }
        Ok(())
    }

    pub fn execute_transaction(ctx: Context<ExecuteTransaction>) -> Result<()> {
        // check that we are provided the correct number of accounts
        if ctx.accounts.transaction.instruction_index < 1 {
            // if no instructions were found, for whatever reason, mark it as executed and move on
            ctx.accounts.transaction.set_executed()?;
            ctx.accounts.multisig.set_processed_index(ctx.accounts.transaction.transaction_index)?;
            return Ok(());            
        }

        if ctx.remaining_accounts[0].owner != ctx.program_id {
            return err!(MsError::InvalidInstructionAccount);
        }

        let ms_key = ctx.accounts.multisig.key().clone();
        // get the authority pda
        let (authority_pda, authority_pda_bump) = Pubkey::find_program_address(&[
            b"squad",
            ms_key.as_ref(),
            &ctx.accounts.transaction.authority_index.to_le_bytes(),
            b"authority"
        ],ctx.program_id);

        let mut ix_account_data: &[u8] = &ctx.remaining_accounts[0].try_borrow_mut_data()?;

        let first_ix = MsInstruction::try_deserialize(&mut ix_account_data)?;

        let (ix_pda, ix_pda_bump) = Pubkey::find_program_address(&[
            b"squad",
            ctx.accounts.transaction.key().as_ref(),
            &first_ix.instruction_index.to_le_bytes(),
            b"instruction"],
            ctx.program_id
        );
        if ix_pda != ctx.remaining_accounts[0].key() {
            return err!(MsError::InvalidInstructionAccount);
        }

        let ix: Instruction = Instruction::from(first_ix);
        msg!("This should be system program {:?}", ctx.remaining_accounts[1].key);
        msg!("This should be sender/auth {:?}", ctx.remaining_accounts[2].key);
        msg!("This should be payee {:?}", ctx.remaining_accounts[3].key);
        msg!("Instruction keys {:?}", ix.accounts);
        msg!("Instruction program_id {:?}", ix.program_id);
        msg!("Instruction {:?}", ix);

        let authority_seeds = [
            b"squad",
            ms_key.as_ref(),
            &ctx.accounts.transaction.authority_index.to_le_bytes(),
            b"authority",
            &[authority_pda_bump]
        ];
        // execute the singular test ix
        invoke_signed(&ix, &[
            ctx.remaining_accounts[1].clone(),  // program account
            ctx.remaining_accounts[2].clone(),  // sender / auth PDA
            ctx.remaining_accounts[3].clone(),  // payee
            ], &[
                &authority_seeds
            ])?;

        ctx.accounts.transaction.set_executed()?;
        ctx.accounts.multisig.set_processed_index(ctx.accounts.transaction.transaction_index)?;
        msg!("Tx had {:?} accounts", ctx.remaining_accounts.len());
        Ok(())
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

#[derive(Accounts)]
pub struct CreateTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        init,
        payer = creator,
        space = 8 + MsTransaction::initial_size_with_members(multisig.keys.len()),
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &multisig.transaction_index.checked_add(1).unwrap().to_le_bytes(),
            b"transaction"
        ], bump
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct AddInstruction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = creator.key() == transaction.creator,
        constraint = transaction.status == MsTransactionStatus::Draft @MsError::InvalidTransactionState,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(
        init,
        payer = creator,
        space = 8 + MsInstruction::MAXIMUM_SIZE,
        seeds = [
            b"squad",
            transaction.key().as_ref(),
            &transaction.instruction_index.checked_add(1).unwrap().to_le_bytes(),
            b"instruction"
        ], bump
    )]
    pub instruction: Account<'info, MsInstruction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System> 
}

#[derive(Accounts)]
pub struct ActivateTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = creator.key() == transaction.creator,
        constraint = transaction.status == MsTransactionStatus::Draft @MsError::InvalidTransactionState,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System> 
}

#[derive(Accounts)]
pub struct ApproveTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::Active @MsError::InvalidTransactionState,
        constraint = multisig.is_member(member.key()) @MsError::KeyNotInMultisig,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System> 
}

#[derive(Accounts)]
pub struct RejectTransaction<'info> {
    #[account(
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::Active @MsError::InvalidTransactionState,
        constraint = multisig.is_member(member.key()) @MsError::KeyNotInMultisig,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System> 
}

#[derive(Accounts)]
pub struct CancelTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
        constraint = multisig.is_member(member.key()) @MsError::KeyNotInMultisig,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System> 
}

#[derive(Accounts)]
pub struct ExecuteTransaction<'info> {
    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.creator.as_ref(),
            b"multisig"
        ],
        bump = multisig.bump,
    )]
    pub multisig: Account<'info, Ms>,

    #[account(
        mut,
        seeds = [
            b"squad",
            multisig.key().as_ref(),
            &transaction.transaction_index.to_le_bytes(),
            b"transaction"
        ], bump = transaction.bump,
        constraint = transaction.status == MsTransactionStatus::ExecuteReady @MsError::InvalidTransactionState,
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System> 
}