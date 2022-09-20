import * as anchor from "@project-serum/anchor";
import { Connection } from "@solana/web3.js";
import { getIxPDA } from "@sqds/sdk";
import { Mesh } from "../target/types/mesh";

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

async function _executeTransaction(
  transactionPDA: anchor.web3.PublicKey,
  feePayer: anchor.web3.PublicKey,
  program: anchor.Program<Mesh>,
): Promise<anchor.web3.TransactionInstruction> {
  const transaction = await program.account.msTransaction.fetch(transactionPDA);
  const ixList = await Promise.all(
    [...new Array(transaction.instructionIndex)].map(async (a, i) => {
      const ixIndexBN = new anchor.BN(i + 1, 10);
      const [ixKey] = getIxPDA(
        transactionPDA,
        ixIndexBN,
        program.programId
      );
      const ixAccount = await program.account.msInstruction.fetch(ixKey);
      return { pubkey: ixKey, ixItem: ixAccount };
    })
  );

  const ixKeysList: anchor.web3.AccountMeta[] = ixList
    .map(({ pubkey, ixItem }) => {
      const ixKeys: anchor.web3.AccountMeta[] =
        ixItem.keys as anchor.web3.AccountMeta[];
      const addSig = anchor.utils.sha256.hash("global:add_member");
      const ixDiscriminator = Buffer.from(addSig, "hex");
      const addData = Buffer.concat([ixDiscriminator.slice(0, 8)]);
      const addAndThreshSig = anchor.utils.sha256.hash(
        "global:add_member_and_change_threshold"
      );
      const ixAndThreshDiscriminator = Buffer.from(addAndThreshSig, "hex");
      const addAndThreshData = Buffer.concat([
        ixAndThreshDiscriminator.slice(0, 8),
      ]);
      const ixData = ixItem.data as any;

      const formattedKeys = ixKeys.map((ixKey, keyInd) => {
        if (
          (ixData.includes(addData) || ixData.includes(addAndThreshData)) &&
          keyInd === 2
        ) {
          return {
            pubkey: feePayer,
            isSigner: false,
            isWritable: ixKey.isWritable,
          };
        }
        return {
          pubkey: ixKey.pubkey,
          isSigner: false,
          isWritable: ixKey.isWritable,
        };
      });

      return [
        { pubkey, isSigner: false, isWritable: false },
        { pubkey: ixItem.programId, isSigner: false, isWritable: false },
        ...formattedKeys,
      ] as anchor.web3.AccountMeta[];
    })
    .reduce((p, c) => p.concat(c), []);

  //  [ix ix_account, ix program_id, key1, key2 ...]
  const keysUnique: anchor.web3.AccountMeta[] = ixKeysList.reduce(
    (prev, curr) => {
      const inList = prev.findIndex(
        (a) => a.pubkey.toBase58() === curr.pubkey.toBase58()
      );
      // if its already in the list, and has same write flag
      if (inList >= 0 && prev[inList].isWritable === curr.isWritable) {
        return prev;
      } else {
        prev.push({
          pubkey: curr.pubkey,
          isWritable: curr.isWritable,
          isSigner: curr.isSigner,
        });
        return prev;
      }
    },
    [] as anchor.web3.AccountMeta[]
  );

  const keyIndexMap = ixKeysList.map((a) => {
    return keysUnique.findIndex(
      (k) =>
        k.pubkey.toBase58() === a.pubkey.toBase58() &&
        k.isWritable === a.isWritable
    );
  });

  const executeIx = await program.methods
    .executeTransaction(Buffer.from(keyIndexMap))
    .accounts({
      multisig: transaction.ms,
      transaction: transactionPDA,
      member: feePayer,
    })
    .instruction();
  executeIx.keys = executeIx.keys.concat(keysUnique);
  return executeIx;
}
export async function executeTransaction(
  transactionPDA: anchor.web3.PublicKey,
  wallet: anchor.Wallet,
  provider: anchor.Provider,
  program: anchor.Program<Mesh>,
  feePayer?: anchor.web3.PublicKey,
  signers?: anchor.web3.Signer[], 
): Promise<string> {
  const payer = feePayer ?? wallet.publicKey;
  const executeIx = await _executeTransaction(transactionPDA, payer, program);

  const { blockhash } = await provider.connection.getLatestBlockhash();
  const lastValidBlockHeight = await provider.connection.getBlockHeight();
  const executeTx = new anchor.web3.Transaction({
    blockhash,
    lastValidBlockHeight,
    feePayer: payer,
  });
  executeTx.add(executeIx);
  return provider.sendAndConfirm(executeTx, signers);
}