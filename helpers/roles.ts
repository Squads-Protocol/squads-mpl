import * as anchor from "@project-serum/anchor";
import { getIxPDA } from "@sqds/sdk";
import { SquadsMpl } from "../idl/squads_mpl";
import { Roles } from "../idl/roles";

export async function getExecuteProxyInstruction(
    transactionPDA: anchor.web3.PublicKey,
    member: anchor.web3.PublicKey,
    user: anchor.web3.PublicKey,
    delegate: anchor.web3.PublicKey,
    squadsMplProgram: anchor.Program<SquadsMpl>,
    rolesProgram: anchor.Program<Roles>,
  ): Promise<anchor.web3.TransactionInstruction> {
    const transaction = await squadsMplProgram.account.msTransaction.fetch(transactionPDA);
    const ixList = await Promise.all(
      [...new Array(transaction.instructionIndex)].map(async (a, i) => {
        const ixIndexBN = new anchor.BN(i + 1, 10);
        const [ixKey] = getIxPDA(
          transactionPDA,
          ixIndexBN,
          squadsMplProgram.programId
        );
        const ixAccount = await squadsMplProgram.account.msInstruction.fetch(ixKey);
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
              pubkey: member,
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
  
    const executeIx = await rolesProgram.methods.executeTxProxy(Buffer.from(keyIndexMap))
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        member,
        user,
        delegate,
        squadsProgram: squadsMplProgram.programId,
      })
      .instruction();
    executeIx.keys = executeIx.keys.concat(keysUnique);
    return executeIx;
  }