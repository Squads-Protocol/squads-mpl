import { createBlankTransaction } from "./transactions";

export const agnosticExecute = async (squads, txPDA, member) => {
    try {
      const executeIx = await squads.buildExecuteTransaction(txPDA, member.publicKey);
      const executeTx = await createBlankTransaction(
        squads.connection,
        member.publicKey
      );
      executeTx.add(executeIx);
      //get the latest blockhash and attach it to the transaction
      const blockhash = await squads.connection.getLatestBlockhash();
      executeTx.recentBlockhash = blockhash.blockhash;
  
      // airdrop a small amount to member2 for feepaying
      await squads.connection.requestAirdrop(member.publicKey, 1000000);
      // sign the transaction on behalf of member2
      await executeTx.sign(member);
      // send the transaction
      const sig = await squads.connection.sendRawTransaction(executeTx.serialize(), {
        skipPreflight: true,
        commitment: "confirmed",
      });
  
      await squads.connection.confirmTransaction(sig, "confirmed");
      return sig;
    } catch (e) {
      console.log("unable to execute add member tx on behalf of ", member.publicKey.toBase58());
      throw e;
    }
  };
  