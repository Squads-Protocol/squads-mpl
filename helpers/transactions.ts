import * as anchor from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";

// some TX/IX helper functions
export const createTestTransferTransaction = async (
  authority: anchor.web3.PublicKey,
  recipient: anchor.web3.PublicKey,
  amount = 1000000
) => {
  return anchor.web3.SystemProgram.transfer({
    fromPubkey: authority,
    lamports: amount,
    toPubkey: recipient,
  });
};

export const createBlankTransaction = async (
  connection: Connection,
  feePayer: anchor.web3.PublicKey
) => {
  const { blockhash } = await connection.getLatestBlockhash();
  const lastValidBlockHeight = await connection.getBlockHeight();

  return new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer,
  });
};