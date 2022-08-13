import {
  Connection,
  PublicKey,
  Commitment,
  ConnectionConfig,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  DEFAULT_MULTISIG_PROGRAM_ID,
  DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
} from "./constants";
import squadsMplJSON from "../../target/idl/squads_mpl.json";
import { SquadsMpl } from "../../target/types/squads_mpl";
import programManagerJSON from "../../target/idl/program_manager.json";
import { ProgramManager } from "../../target/types/program_manager";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import { AnchorProvider, Program } from "@project-serum/anchor";
import {
  InstructionAccount,
  ManagedProgramAccount,
  MultisigAccount,
  ProgramManagerAccount,
  ProgramUpgradeAccount,
  TransactionAccount,
} from "./types";
import { getIxPDA, getMsPDA, getTxPDA } from "./address";
import BN from "bn.js";
import * as anchor from "@project-serum/anchor";

class Squads {
  readonly connection: Connection;
  readonly wallet: Wallet;
  private readonly provider: AnchorProvider;
  readonly multisigProgramId: PublicKey;
  private readonly multisig: Program<SquadsMpl>;
  readonly programManagerProgramId: PublicKey;
  private readonly programManager: Program<ProgramManager>;

  constructor({
    connection,
    wallet,
    multisigProgramId,
    programManagerProgramId,
  }: {
    connection: Connection;
    wallet: Wallet;
    multisigProgramId?: PublicKey;
    programManagerProgramId?: PublicKey;
  }) {
    this.connection = connection;
    this.wallet = wallet;
    this.multisigProgramId = multisigProgramId ?? DEFAULT_MULTISIG_PROGRAM_ID;
    this.provider = new AnchorProvider(
      this.connection,
      this.wallet,
      AnchorProvider.defaultOptions()
    );
    this.multisig = new Program<SquadsMpl>(
      squadsMplJSON as SquadsMpl,
      this.multisigProgramId,
      this.provider
    );
    this.programManagerProgramId =
      programManagerProgramId ?? DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
    this.programManager = new Program<ProgramManager>(
      programManagerJSON as ProgramManager,
      this.programManagerProgramId,
      this.provider
    );
  }

  static endpoint(
    endpoint: string,
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(endpoint, options?.commitmentOrConfig),
      wallet,
      ...options,
    });
  }
  static mainnet(
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(
        "https://api.mainnet-beta.solana.com",
        options?.commitmentOrConfig
      ),
      wallet,
      ...options,
    });
  }
  static devnet(
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(
        "https://api.devnet.solana.com",
        options?.commitmentOrConfig
      ),
      wallet,
      ...options,
    });
  }
  static localnet(
    wallet: Wallet,
    options?: {
      commitmentOrConfig?: Commitment | ConnectionConfig;
      multisigProgramId?: PublicKey;
      programManagerProgramId?: PublicKey;
    }
  ) {
    return new Squads({
      connection: new Connection(
        "http://localhost:8899",
        options?.commitmentOrConfig
      ),
      wallet,
      ...options,
    });
  }

  private _addPublicKeys(items: any[], addresses: PublicKey[]): (any | null)[] {
    return items.map((item, index) =>
      item ? { ...item, publicKey: addresses[index] } : null
    );
  }

  async getMultisig(address: PublicKey): Promise<MultisigAccount> {
    const accountData = await this.multisig.account.ms.fetch(address);
    return { ...accountData, publicKey: address } as MultisigAccount;
  }
  async getMultisigs(
    addresses: PublicKey[]
  ): Promise<(MultisigAccount | null)[]> {
    const accountData = await this.multisig.account.ms.fetchMultiple(addresses);
    return this._addPublicKeys(
      accountData,
      addresses
    ) as (MultisigAccount | null)[];
  }
  async getTransaction(address: PublicKey): Promise<TransactionAccount> {
    const accountData = await this.multisig.account.msTransaction.fetch(
      address
    );
    return { ...accountData, publicKey: address };
  }
  async getTransactions(
    addresses: PublicKey[]
  ): Promise<(TransactionAccount | null)[]> {
    const accountData = await this.multisig.account.msTransaction.fetchMultiple(
      addresses
    );
    return this._addPublicKeys(
      accountData,
      addresses
    ) as (TransactionAccount | null)[];
  }
  async getInstruction(address: PublicKey): Promise<InstructionAccount> {
    const accountData = await this.multisig.account.msInstruction.fetch(
      address
    );
    return { ...accountData, publicKey: address };
  }
  async getInstructions(
    addresses: PublicKey[]
  ): Promise<(InstructionAccount | null)[]> {
    const accountData = await this.multisig.account.msInstruction.fetchMultiple(
      addresses
    );
    return this._addPublicKeys(
      accountData,
      addresses
    ) as (InstructionAccount | null)[];
  }

  async getProgramManager(address: PublicKey): Promise<ProgramManagerAccount> {
    const accountData = await this.programManager.account.programManager.fetch(
      address
    );
    return { ...accountData, publicKey: address };
  }
  async getProgramManagers(
    addresses: PublicKey[]
  ): Promise<(ProgramManagerAccount | null)[]> {
    const accountData =
      await this.programManager.account.programManager.fetchMultiple(addresses);
    return this._addPublicKeys(
      accountData,
      addresses
    ) as (ProgramManagerAccount | null)[];
  }
  async getManagedProgram(address: PublicKey): Promise<ManagedProgramAccount> {
    const accountData = await this.programManager.account.managedProgram.fetch(
      address
    );
    return { ...accountData, publicKey: address };
  }
  async getManagedPrograms(
    addresses: PublicKey[]
  ): Promise<(ManagedProgramAccount | null)[]> {
    const accountData =
      await this.programManager.account.managedProgram.fetchMultiple(addresses);
    return this._addPublicKeys(
      accountData,
      addresses
    ) as (ManagedProgramAccount | null)[];
  }
  async getProgramUpgrade(address: PublicKey): Promise<ProgramUpgradeAccount> {
    const accountData = await this.programManager.account.programUpgrade.fetch(
      address
    );
    return { ...accountData, publicKey: address };
  }
  async getProgramUpgrades(
    addresses: PublicKey[]
  ): Promise<(ProgramUpgradeAccount | null)[]> {
    const accountData =
      await this.programManager.account.programUpgrade.fetchMultiple(addresses);
    return this._addPublicKeys(
      accountData,
      addresses
    ) as (ProgramUpgradeAccount | null)[];
  }

  async getNextTransactionIndex(multisigPDA: PublicKey): Promise<number> {
    const multisig = await this.getMultisig(multisigPDA);
    return multisig.transactionIndex + 1;
  }

  async getNextInstructionIndex(transactionPDA: PublicKey): Promise<number> {
    const transaction = await this.getTransaction(transactionPDA);
    return transaction.instructionIndex + 1;
  }

  async getNextProgramIndex(programManagerPDA: PublicKey): Promise<number> {
    const programManager = await this.getProgramManager(programManagerPDA);
    return programManager.managedProgramIndex + 1;
  }

  async getNextUpgradeIndex(managedProgramPDA: PublicKey): Promise<number> {
    const managedProgram = await this.getManagedProgram(managedProgramPDA);
    return managedProgram.upgradeIndex + 1;
  }

  async createMultisig(
    threshold: number,
    createKey: PublicKey,
    initialMembers: PublicKey[]
  ): Promise<MultisigAccount> {
    if (
      !initialMembers.find((member) => member.equals(this.wallet.publicKey))
    ) {
      initialMembers.push(this.wallet.publicKey);
    }
    const [multisigPDA] = getMsPDA(createKey, this.multisigProgramId);
    await this.multisig.methods
      .create(threshold, createKey, initialMembers)
      .accounts({ multisig: multisigPDA, creator: this.wallet.publicKey })
      .rpc();
    return await this.getMultisig(multisigPDA);
  }
  async createTransaction(
    multisigPDA: PublicKey,
    authorityIndex: number
  ): Promise<TransactionAccount> {
    const nextTransactionIndex = await this.getNextTransactionIndex(
      multisigPDA
    );
    const [transactionPDA] = getTxPDA(
      multisigPDA,
      new BN(nextTransactionIndex, 10),
      this.multisigProgramId
    );
    await this.multisig.methods
      .createTransaction(authorityIndex)
      .accounts({
        multisig: multisigPDA,
        transaction: transactionPDA,
        creator: this.wallet.publicKey,
      })
      .rpc();
    return await this.getTransaction(transactionPDA);
  }
  async addInstruction(
    transactionPDA: PublicKey,
    instruction: TransactionInstruction
  ): Promise<InstructionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const [instructionPDA] = getIxPDA(
      transactionPDA,
      new BN(transaction.instructionIndex + 1, 10),
      this.multisigProgramId
    );
    await this.multisig.methods
      .addInstruction(instruction)
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        instruction: instructionPDA,
        creator: this.wallet.publicKey,
      })
      .rpc();
    return await this.getInstruction(instructionPDA);
  }
  async activateTransaction(
    transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    await this.multisig.methods
      .activateTransaction()
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        creator: this.wallet.publicKey,
      })
      .rpc();
    return await this.getTransaction(transactionPDA);
  }
  async approveTransaction(
    transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    await this.multisig.methods
      .approveTransaction()
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        member: this.wallet.publicKey,
      })
      .rpc();
    return await this.getTransaction(transactionPDA);
  }
  async rejectTransaction(
    transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    await this.multisig.methods
      .rejectTransaction()
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        member: this.wallet.publicKey,
      })
      .rpc();
    return await this.getTransaction(transactionPDA);
  }
  async cancelTransaction(
    transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    await this.multisig.methods
      .cancelTransaction()
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        member: this.wallet.publicKey,
      })
      .rpc();
    return await this.getTransaction(transactionPDA);
  }
  async executeTransaction(
    transactionPDA: PublicKey,
    feePayer?: Wallet
  ): Promise<TransactionAccount> {
    const payer = feePayer ?? this.wallet;
    const transaction = await this.getTransaction(transactionPDA);
    const ixList = await Promise.all(
      [...new Array(transaction.instructionIndex)].map(async (a, i) => {
        const ixIndexBN = new anchor.BN(i + 1, 10);
        const [ixKey] = getIxPDA(
          transactionPDA,
          ixIndexBN,
          this.multisigProgramId
        );
        const ixAccount = await this.getInstruction(ixKey);
        return { pubkey: ixKey, ixItem: ixAccount };
      })
    );

    const ixKeysList: anchor.web3.AccountMeta[] = ixList
      .map(({ pubkey, ixItem }) => {
        const ixKeys: anchor.web3.AccountMeta[] =
          ixItem.keys as anchor.web3.AccountMeta[];
        const sig = anchor.utils.sha256.hash("global:add_member");
        const ixDiscriminator = Buffer.from(sig, "hex");
        const data = Buffer.concat([ixDiscriminator.slice(0, 8)]);
        const ixData = ixItem.data as any;

        const formattedKeys = ixKeys.map((ixKey, keyInd) => {
          if (ixData.includes(data) && keyInd === 2) {
            return {
              pubkey: payer.publicKey,
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
        ];
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

    const { blockhash } = await this.connection.getLatestBlockhash();
    const lastValidBlockHeight = await this.connection.getBlockHeight();

    const executeTx = new anchor.web3.Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: payer.publicKey,
    });

    const executeIx = await this.multisig.methods
      .executeTransaction(Buffer.from(keyIndexMap))
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        member: payer.publicKey,
      })
      .instruction();
    executeIx.keys = executeIx.keys.concat(keysUnique);
    executeTx.add(executeIx);
    await this.provider.sendAndConfirm(executeTx);
    return await this.getTransaction(transactionPDA);
  }
  async executeInstruction(
    transactionPDA: PublicKey,
    instructionPDA: PublicKey
  ): Promise<InstructionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const instruction = await this.getInstruction(instructionPDA);
    const remainingAccountKeys: anchor.web3.AccountMeta[] = [
      { pubkey: instruction.programId, isSigner: false, isWritable: false },
    ].concat(
      (instruction.keys as anchor.web3.AccountMeta[]).map((key) => ({
        ...key,
        isSigner: false,
      }))
    );
    await this.multisig.methods
      .executeInstruction()
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        instruction: instructionPDA,
        member: this.wallet.publicKey,
      })
      .remainingAccounts(remainingAccountKeys)
      .rpc();

    return await this.getInstruction(instructionPDA);
  }

  async createProgramManager() {}
  async createManagedProgram() {}
  async createProgramUpgrade() {}
  async markUpgradeCompleted() {}
}

export default Squads;

export * from "./constants";
export * from "./address";
