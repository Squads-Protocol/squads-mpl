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

    pub fn create_transaction(ctx: Context<CreateTransaction>) -> Result<()> {
        let ms = &mut ctx.accounts.multisig;
        ms.transaction_index =  ms.transaction_index.checked_add(1).unwrap();
        ctx.accounts.transaction.init(
            ctx.accounts.creator.key(),
            ms.transaction_index,
            *ctx.bumps.get("transaction").unwrap()
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

    pub fn approve_transaction(ctx: Context<ApproveTransaction>) -> Result<()> {
        // sign/approve the transaction
        ctx.accounts.transaction.sign(ctx.accounts.member.key())?;

        // if current number of signers reaches threshold, mark the transaction as execute ready
        if ctx.accounts.transaction.approved.len() >= usize::from(ctx.accounts.multisig.threshold) {
            ctx.accounts.transaction.ready_to_execute()?;
        }
        Ok(())
    }

    pub fn reject_transaction(ctx: Context<RejectTransaction>) -> Result<()> {
        ctx.accounts.transaction.reject(ctx.accounts.member.key())
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
        constraint = transaction.status == MsTransactionStatus::Draft
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
        constraint = transaction.status == MsTransactionStatus::Draft
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
        constraint = transaction.status == MsTransactionStatus::Active,
        constraint = multisig.is_member(member.key()) @MsError::KeyNotInMultisig,
        constraint = transaction.has_voted(member.key()) ==  false
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
        constraint = transaction.status == MsTransactionStatus::Active,
        constraint = multisig.is_member(member.key()) @MsError::KeyNotInMultisig,
        constraint = transaction.has_voted(member.key()) == false
    )]
    pub transaction: Account<'info, MsTransaction>,

    #[account(mut)]
    pub member: Signer<'info>,
    pub system_program: Program<'info, System> 
}

#[error_code]
pub enum MsError {
    KeyNotInMultisig,
    InvalidTransactionState
}