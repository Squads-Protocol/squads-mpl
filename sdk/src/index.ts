import {
  Connection,
  PublicKey,
  Commitment,
  ConnectionConfig,
  TransactionInstruction,
  Signer,
  ConfirmOptions,
  AccountMeta,
  VersionedTransaction,
  TransactionMessage,
  AddressLookupTableAccount,
} from "@solana/web3.js"
import {
  DEFAULT_MULTISIG_PROGRAM_ID,
  DEFAULT_PROGRAM_MANAGER_PROGRAM_ID,
} from "./constants";
import squadsMplJSON from "../../target/idl/squads_mpl.json";
import {SquadsMpl} from "../../target/types/squads_mpl";
import programManagerJSON from "../../target/idl/program_manager.json";
import { ProgramManager } from "../../target/types/program_manager";
import { Wallet } from "@project-serum/anchor/dist/cjs/provider";
import {Address, AnchorProvider, Program, web3} from "@project-serum/anchor"
import {
  InstructionAccount,
  ManagedProgramAccount,
  MultisigAccount,
  ProgramManagerAccount,
  ProgramUpgradeAccount,
  SquadsMethods,
  TransactionAccount, TransactionV2Account,
} from "./types"
import {
  getAuthorityPDA,
  getIxPDA,
  getManagedProgramPDA,
  getMsPDA,
  getProgramManagerPDA,
  getProgramUpgradePDA,
  getTxPDA,
} from "./address";
import BN from "bn.js";
import * as anchor from "@project-serum/anchor";
import {TransactionBuilder} from "./tx_builder";
import {transactionMessageBeet, TransactionMessage as MsTransactionMessage} from "./beets"
import * as assert from "assert"

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
        {...AnchorProvider.defaultOptions(), commitment: "confirmed", preflightCommitment: "confirmed"}
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
        item ? {...item, publicKey: addresses[index]} : null
    );
  }

  async getTransactionBuilder(
      multisigPDA: PublicKey,
      authorityIndex: number
  ): Promise<TransactionBuilder> {
    const multisig = await this.getMultisig(multisigPDA);
    return new TransactionBuilder(
        this.multisig.methods,
        this.programManager.methods,
        this.provider,
        multisig,
        authorityIndex,
        this.multisigProgramId
    );
  }

  async getMultisig(address: PublicKey): Promise<MultisigAccount> {
    const accountData = await this.multisig.account.ms.fetch(address, "processed");
    return {...accountData, publicKey: address} as MultisigAccount;
  }

  async getMultisigs(
      addresses: PublicKey[]
  ): Promise<(MultisigAccount | null)[]> {
    const accountData = await this.multisig.account.ms.fetchMultiple(addresses, "processed");
    return this._addPublicKeys(
        accountData,
        addresses
    ) as (MultisigAccount | null)[];
  }

  async getTransaction(address: PublicKey): Promise<TransactionAccount> {
    const accountData = await this.multisig.account.msTransaction.fetch(
        address,
        "processed"
    );
    return {...accountData, publicKey: address};
  }
  async getTransactionV2(address: PublicKey): Promise<TransactionV2Account> {
    const accountData = await this.multisig.account.msTransactionV2.fetch(
      address,
      "processed"
    );
    return { ...accountData, publicKey: address };
  }
  async getTransactions(
      addresses: PublicKey[]
  ): Promise<(TransactionAccount | null)[]> {
    const accountData = await this.multisig.account.msTransaction.fetchMultiple(
        addresses,
        "processed"
    );
    return this._addPublicKeys(
        accountData,
        addresses
    ) as (TransactionAccount | null)[];
  }

  async getInstruction(address: PublicKey): Promise<InstructionAccount> {
    const accountData = await this.multisig.account.msInstruction.fetch(
        address,
        "processed"
    );
    return {...accountData, publicKey: address};
  }

  async getInstructions(
      addresses: PublicKey[]
  ): Promise<(InstructionAccount | null)[]> {
    const accountData = await this.multisig.account.msInstruction.fetchMultiple(
        addresses,
        "processed"
    );
    return this._addPublicKeys(
        accountData,
        addresses
    ) as (InstructionAccount | null)[];
  }

  async getProgramManager(address: PublicKey): Promise<ProgramManagerAccount> {
    const accountData = await this.programManager.account.programManager.fetch(
        address,
        "processed"
    );
    return {...accountData, publicKey: address};
  }

  async getProgramManagers(
      addresses: PublicKey[]
  ): Promise<(ProgramManagerAccount | null)[]> {
    const accountData =
        await this.programManager.account.programManager.fetchMultiple(addresses, "processed");
    return this._addPublicKeys(
        accountData,
        addresses
    ) as (ProgramManagerAccount | null)[];
  }

  async getManagedProgram(address: PublicKey): Promise<ManagedProgramAccount> {
    const accountData = await this.programManager.account.managedProgram.fetch(
        address,
        "processed"
    );
    return {...accountData, publicKey: address};
  }

  async getManagedPrograms(
      addresses: PublicKey[]
  ): Promise<(ManagedProgramAccount | null)[]> {
    const accountData =
        await this.programManager.account.managedProgram.fetchMultiple(addresses, "processed");
    return this._addPublicKeys(
        accountData,
        addresses
    ) as (ManagedProgramAccount | null)[];
  }

  async getProgramUpgrade(address: PublicKey): Promise<ProgramUpgradeAccount> {
    const accountData = await this.programManager.account.programUpgrade.fetch(
        address,
        "processed"
    );
    return {...accountData, publicKey: address};
  }

  async getProgramUpgrades(
      addresses: PublicKey[]
  ): Promise<(ProgramUpgradeAccount | null)[]> {
    const accountData =
        await this.programManager.account.programUpgrade.fetchMultiple(addresses, "processed");
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

  getAuthorityPDA(multisigPDA: PublicKey, authorityIndex: number): PublicKey {
    return getAuthorityPDA(
        multisigPDA,
        new BN(authorityIndex, 10),
        this.multisigProgramId
    )[0];
  }

  private _createMultisig(
      threshold: number,
      createKey: PublicKey,
      initialMembers: PublicKey[],
      name: string,
      description = "",
      image = ""
  ): [SquadsMethods, PublicKey] {
    if (
        !initialMembers.find((member) => member.equals(this.wallet.publicKey))
    ) {
      initialMembers.push(this.wallet.publicKey);
    }
    const [multisigPDA] = getMsPDA(createKey, this.multisigProgramId);
    return [
      this.multisig.methods
          .create(threshold, createKey, initialMembers, JSON.stringify({name, description, image}))
          .accounts({multisig: multisigPDA, creator: this.wallet.publicKey}),
      multisigPDA,
    ];
  }

  async createMultisig(
      threshold: number,
      createKey: PublicKey,
      initialMembers: PublicKey[],
      name: string,
      description = "",
      image = ""
  ): Promise<MultisigAccount> {
    const [methods, multisigPDA] = this._createMultisig(
        threshold,
        createKey,
        initialMembers,
        JSON.stringify({name, description, image})
    );
    await methods.rpc();
    return await this.getMultisig(multisigPDA);
  }

  async buildCreateMultisig(
      threshold: number,
      createKey: PublicKey,
      initialMembers: PublicKey[],
      name: string,
      description = "",
      image = ""
  ): Promise<TransactionInstruction> {
    const [methods] = this._createMultisig(
        threshold,
        createKey,
        initialMembers,
        JSON.stringify({name, description, image})
    );
    return await methods.instruction();
  }

  private async _createTransaction(
      multisigPDA: PublicKey,
      authorityIndex: number,
      transactionIndex: number
  ): Promise<[SquadsMethods, PublicKey]> {
    const [transactionPDA] = getTxPDA(
        multisigPDA,
        new BN(transactionIndex, 10),
        this.multisigProgramId
    );
    return [
      this.multisig.methods.createTransaction(authorityIndex).accounts({
        multisig: multisigPDA,
        transaction: transactionPDA,
        creator: this.wallet.publicKey,
      }),
      transactionPDA,
    ];
  }

  async createTransaction(
      multisigPDA: PublicKey,
      authorityIndex: number
  ): Promise<TransactionAccount> {
    const nextTransactionIndex = await this.getNextTransactionIndex(
        multisigPDA
    );
    const [methods, transactionPDA] = await this._createTransaction(
        multisigPDA,
        authorityIndex,
        nextTransactionIndex
    );
    await methods.rpc();
    return await this.getTransaction(transactionPDA);
  }

  async buildCreateTransaction(
      multisigPDA: PublicKey,
      authorityIndex: number,
      transactionIndex: number
  ): Promise<TransactionInstruction> {
    const [methods] = await this._createTransaction(
        multisigPDA,
        authorityIndex,
        transactionIndex
    );
    return await methods.instruction();
  }

  private async _addInstruction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey,
      instruction: TransactionInstruction,
      instructionIndex: number
  ): Promise<[SquadsMethods, PublicKey]> {
    const [instructionPDA] = getIxPDA(
        transactionPDA,
        new BN(instructionIndex, 10),
        this.multisigProgramId
    );
    return [
      this.multisig.methods.addInstruction(instruction).accounts({
        multisig: multisigPDA,
        transaction: transactionPDA,
        instruction: instructionPDA,
        creator: this.wallet.publicKey,
      }),
      instructionPDA,
    ];
  }

  async addInstruction(
      transactionPDA: PublicKey,
      instruction: TransactionInstruction
  ): Promise<InstructionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const [methods, instructionPDA] = await this._addInstruction(
        transaction.ms,
        transactionPDA,
        instruction,
        transaction.instructionIndex + 1
    );
    await methods.rpc();
    return await this.getInstruction(instructionPDA);
  }

  async buildAddInstruction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey,
      instruction: TransactionInstruction,
      instructionIndex: number
  ): Promise<TransactionInstruction> {
    const [methods] = await this._addInstruction(
        multisigPDA,
        transactionPDA,
        instruction,
        instructionIndex
    );
    return await methods.instruction();
  }

  private async _activateTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<SquadsMethods> {
    return this.multisig.methods.activateTransaction().accounts({
      multisig: multisigPDA,
      transaction: transactionPDA,
      creator: this.wallet.publicKey,
    });
  }

  async activateTransaction(
      transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const methods = await this._activateTransaction(
        transaction.ms,
        transactionPDA
    );
    await methods.rpc();
    return await this.getTransaction(transactionPDA);
  }

  async buildActivateTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<TransactionInstruction> {
    const methods = await this._activateTransaction(
        multisigPDA,
        transactionPDA
    );
    return await methods.instruction();
  }

  private async _approveTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<SquadsMethods> {
    return this.multisig.methods.approveTransaction().accounts({
      multisig: multisigPDA,
      transaction: transactionPDA,
      member: this.wallet.publicKey,
    });
  }

  async approveTransaction(
      transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const methods = await this._approveTransaction(
        transaction.ms,
        transactionPDA
    );
    await methods.rpc();
    return await this.getTransaction(transactionPDA);
  }

  async buildApproveTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<TransactionInstruction> {
    const methods = await this._approveTransaction(multisigPDA, transactionPDA);
    return await methods.instruction();
  }

  private async _rejectTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<SquadsMethods> {
    return this.multisig.methods.rejectTransaction().accounts({
      multisig: multisigPDA,
      transaction: transactionPDA,
      member: this.wallet.publicKey,
    });
  }

  async rejectTransaction(
      transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const methods = await this._rejectTransaction(
        transaction.ms,
        transactionPDA
    );
    await methods.rpc();
    return await this.getTransaction(transactionPDA);
  }

  async buildRejectTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<TransactionInstruction> {
    const methods = await this._rejectTransaction(multisigPDA, transactionPDA);
    return await methods.instruction();
  }

  private async _cancelTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<SquadsMethods> {
    return this.multisig.methods.cancelTransaction().accounts({
      multisig: multisigPDA,
      transaction: transactionPDA,
      member: this.wallet.publicKey,
    });
  }

  async cancelTransaction(
      transactionPDA: PublicKey
  ): Promise<TransactionAccount> {
    const transaction = await this.getTransaction(transactionPDA);
    const methods = await this._cancelTransaction(
        transaction.ms,
        transactionPDA
    );
    await methods.rpc();
    return await this.getTransaction(transactionPDA);
  }

  async buildCancelTransaction(
      multisigPDA: PublicKey,
      transactionPDA: PublicKey
  ): Promise<TransactionInstruction> {
    const methods = await this._cancelTransaction(multisigPDA, transactionPDA);
    return await methods.instruction();
  }

  private async _executeTransaction(
      transactionPDA: PublicKey,
      feePayer: PublicKey
  ): Promise<TransactionInstruction> {
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
          return {pubkey: ixKey, ixItem: ixAccount};
        })
    );

    const ixKeysList: anchor.web3.AccountMeta[] = ixList
        .map(({pubkey, ixItem}) => {
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
            {pubkey, isSigner: false, isWritable: false},
            {pubkey: ixItem.programId, isSigner: false, isWritable: false},
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

    const executeIx = await this.multisig.methods
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

  async executeTransaction(
      transactionPDA: PublicKey,
      feePayer?: PublicKey,
      signers?: Signer[]
  ): Promise<TransactionAccount> {
    const payer = feePayer ?? this.wallet.publicKey;
    const executeIx = await this._executeTransaction(transactionPDA, payer);

    const {blockhash} = await this.connection.getLatestBlockhash();
    const lastValidBlockHeight = await this.connection.getBlockHeight();
    const executeTx = new anchor.web3.Transaction({
      blockhash,
      lastValidBlockHeight,
      feePayer: payer,
    });
    executeTx.add(executeIx);
    await this.provider.sendAndConfirm(executeTx, signers);
    return await this.getTransaction(transactionPDA);
  }

  async buildExecuteTransaction(
      transactionPDA: PublicKey,
      feePayer?: PublicKey
  ): Promise<TransactionInstruction> {
    const payer = feePayer ?? this.wallet.publicKey;
    return await this._executeTransaction(transactionPDA, payer);
  }

  private async _executeInstruction(
      transactionPDA: PublicKey,
      instructionPDA: PublicKey
  ): Promise<SquadsMethods> {
    const transaction = await this.getTransaction(transactionPDA);
    const instruction = await this.getInstruction(instructionPDA);
    const remainingAccountKeys: anchor.web3.AccountMeta[] = [
      {pubkey: instruction.programId, isSigner: false, isWritable: false},
    ].concat(
        (instruction.keys as anchor.web3.AccountMeta[]).map((key) => ({
          ...key,
          isSigner: false,
        }))
    );
    return this.multisig.methods
        .executeInstruction()
        .accounts({
          multisig: transaction.ms,
          transaction: transactionPDA,
          instruction: instructionPDA,
          member: this.wallet.publicKey,
        })
        .remainingAccounts(remainingAccountKeys);
  }

  async executeInstruction(
      transactionPDA: PublicKey,
      instructionPDA: PublicKey
  ): Promise<InstructionAccount> {
    const methods = await this._executeInstruction(
        transactionPDA,
        instructionPDA
    );
    await methods.rpc();
    return await this.getInstruction(instructionPDA);
  }

  async buildExecuteInstruction(
      transactionPDA: PublicKey,
      instructionPDA: PublicKey
  ): Promise<TransactionInstruction> {
    const methods = await this._executeInstruction(
        transactionPDA,
        instructionPDA
    );
    return await methods.instruction();
  }

  async createProgramManager(
      multisigPDA: PublicKey
  ): Promise<ProgramManagerAccount> {
    const [programManagerPDA] = getProgramManagerPDA(
        multisigPDA,
        this.programManagerProgramId
    );
    await this.programManager.methods
        .createProgramManager()
        .accounts({multisig: multisigPDA, programManager: programManagerPDA})
        .rpc();
    return await this.getProgramManager(programManagerPDA);
  }

  async createManagedProgram(
      multisigPDA: PublicKey,
      programAddress: PublicKey,
      name: string
  ): Promise<ManagedProgramAccount> {
    const [programManagerPDA] = getProgramManagerPDA(
        multisigPDA,
        this.programManagerProgramId
    );
    const [managedProgramPDA] = getManagedProgramPDA(
        programManagerPDA,
        new BN(await this.getNextProgramIndex(programManagerPDA), 10),
        this.programManagerProgramId
    );
    await this.programManager.methods
        .createManagedProgram(programAddress, name)
        .accounts({
          multisig: multisigPDA,
          programManager: programManagerPDA,
          managedProgram: managedProgramPDA,
        })
        .rpc();
    return await this.getManagedProgram(managedProgramPDA);
  }

  async createProgramUpgrade(
      multisigPDA: PublicKey,
      managedProgramPDA: PublicKey,
      bufferAddress: PublicKey,
      spillAddress: PublicKey,
      authorityAddress: PublicKey,
      upgradeName: string
  ): Promise<ProgramUpgradeAccount> {
    const [programManagerPDA] = getProgramManagerPDA(
        multisigPDA,
        this.programManagerProgramId
    );
    const [programUpgradePDA] = getProgramUpgradePDA(
        managedProgramPDA,
        new BN(await this.getNextUpgradeIndex(managedProgramPDA), 10),
        this.programManagerProgramId
    );
    await this.programManager.methods
        .createProgramUpgrade(
            bufferAddress,
            spillAddress,
            authorityAddress,
            upgradeName
        )
        .accounts({
          multisig: multisigPDA,
          programManager: programManagerPDA,
          managedProgram: managedProgramPDA,
          programUpgrade: programUpgradePDA,
        })
        .rpc();
    return await this.getProgramUpgrade(programUpgradePDA);
  }
  async buildCreateTransactionV2(
    multisigPDA: PublicKey,
    authorityIndex: number,
    message: TransactionMessage,
    addressLookupTableAccounts?: AddressLookupTableAccount[]
  ): Promise<[TransactionInstruction, PublicKey]> {
    // .compileToV0Message([alt.value]);
    // console.log("message.staticAccountKeys", JSON.stringify(testTransferMessageV0.staticAccountKeys, null, 2))
    // console.log("message.addressTableLookups:", JSON.stringify(testTransferMessageV0.addressTableLookups, null, 2))
    const nextTransactionIndex = await this.getNextTransactionIndex(
      multisigPDA
    );
    const [transactionPDA] = getTxPDA(
      multisigPDA,
      new BN(nextTransactionIndex, 10),
      this.multisigProgramId
    );
    const createTxInstruction = await this._buildCreateTransactionV2(multisigPDA, transactionPDA, authorityIndex, message, addressLookupTableAccounts);

    return [createTxInstruction, transactionPDA];
  }
  private async _buildCreateTransactionV2(
    multisigPDA: PublicKey,
    transactionPDA: PublicKey,
    authorityIndex: number,
    message: TransactionMessage,
    addressLookupTableAccounts?: AddressLookupTableAccount[]
  ): Promise<TransactionInstruction> {
    const authorityPDA = await this.getAuthorityPDA(multisigPDA, authorityIndex);
    // Make sure authority is marked as non-signer in all instructions,
    // otherwise the message will be serialized in incorrect format.
    message.instructions.forEach((instruction) => {
      instruction.keys.forEach((key) => {
        if (key.pubkey.equals(authorityPDA)) {
          key.isSigner = false;
        }
      });
    });

    const compiledMessage = message.compileToV0Message(addressLookupTableAccounts);

    const [transactionMessageBytes] = transactionMessageBeet.serialize({
        numSigners: compiledMessage.header.numRequiredSignatures,
        numWritableSigners: compiledMessage.header.numRequiredSignatures - compiledMessage.header.numReadonlySignedAccounts,
        numWritableNonSigners: compiledMessage.staticAccountKeys.length - compiledMessage.header.numRequiredSignatures - compiledMessage.header.numReadonlyUnsignedAccounts,
        accountKeys: compiledMessage.staticAccountKeys,
        instructions: compiledMessage.compiledInstructions.map((ix) => {
          return {
            programIdIndex: ix.programIdIndex,
            accountIndexes: ix.accountKeyIndexes,
            data: Array.from(ix.data),
          }
        }),
        addressTableLookups: compiledMessage.addressTableLookups,
      }
    )

    return await this.multisig.methods.createTransactionV2(authorityIndex, transactionMessageBytes)
      .accounts({
        multisig: multisigPDA,
        transaction: transactionPDA,
        creator: this.provider.wallet.publicKey,
      })
      .instruction();
  }
  async buildApproveTransactionV2(
    transactionPDA: PublicKey,
  ): Promise<TransactionInstruction> {
    const transaction = await this.getTransactionV2(transactionPDA);

    return await this.multisig.methods.approveTransactionV2().accounts({
      multisig: transaction.ms,
      transaction: transactionPDA,
      member: this.wallet.publicKey,
    }).instruction();
  }
  async approveTransactionV2(
    transactionPDA: PublicKey,
    confirmOptions?: ConfirmOptions
  ): Promise<TransactionV2Account> {
    const transaction = await this.getTransactionV2(transactionPDA);
    await this.multisig.methods.approveTransactionV2().accounts({
      multisig: transaction.ms,
      transaction: transactionPDA,
      member: this.wallet.publicKey,
    }).rpc(confirmOptions);
    return await this.getTransactionV2(transactionPDA);
  }
  async buildExecuteTransactionV2(
    transactionPDA: PublicKey,
    feePayer?: PublicKey,
  ): Promise<VersionedTransaction> {
    const payer = feePayer ?? this.wallet.publicKey;

    return await this._buildExecuteTransactionV2(transactionPDA, payer);
  }
  private async _buildExecuteTransactionV2(
    transactionPDA: PublicKey,
    feePayer: PublicKey
  ): Promise<VersionedTransaction> {
    const transaction = await this.getTransactionV2(transactionPDA);
    const authorityPda = this.getAuthorityPDA(transaction.ms, transaction.authorityIndex);

    const message = transaction.message as MsTransactionMessage

    const addressLookupTableKeys: PublicKey[] = (message.addressTableLookups as any).map(({ accountKey }: { accountKey: anchor.web3.PublicKey }) => accountKey)
    const addressLookupTableAccounts: Map<string, AddressLookupTableAccount> = new Map(
      await Promise.all(
        addressLookupTableKeys.map(async (key) => {
          const { value } = await this.connection.getAddressLookupTable(key)
          if (!value) {
            throw new Error(`Address lookup table account ${key.toBase58()} not found`)
          }
          return [key.toBase58(), value] as const
        }))
    )

    // Populate remaining accounts required for execution of the transaction.
    const remainingAccounts: AccountMeta[] = [];
    // First add the lookup table accounts used by the transaction. They are needed for on-chain validation.
    remainingAccounts.push(...addressLookupTableKeys.map((key) => {
      return { pubkey: key, isSigner: false, isWritable: false }
    }));
    // Then add static account keys included into the message.
    for (const [accountIndex, accountKey] of message.accountKeys.entries()) {
      remainingAccounts.push({
        pubkey: accountKey,
        isWritable: isWritableIndex(message, accountIndex),
        // NOTE: authorityPda cannot be marked as signer because it's a PDA.
        isSigner: isSignerIndex(message, accountIndex) && !accountKey.equals(authorityPda)
      })
    }
    // Then add accounts that will be loaded with address lookup tables.
    for (const lookup of message.addressTableLookups) {
      const lookupTableAccount = addressLookupTableAccounts.get(lookup.accountKey.toBase58())
      assert.ok(lookupTableAccount, `Address lookup table account ${lookup.accountKey.toBase58()} not found`)

      for (const accountIndex of lookup.writableIndexes) {
        const pubkey = lookupTableAccount.state.addresses[accountIndex]
        assert.ok(pubkey, `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`)
        remainingAccounts.push({
          pubkey,
          isWritable: true,
          // Accounts in address lookup tables can not be signers.
          isSigner: false
        })
      }
      for (const accountIndex of lookup.readonlyIndexes) {
        const pubkey = lookupTableAccount.state.addresses[accountIndex]
        assert.ok(pubkey, `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`)
        remainingAccounts.push({
          pubkey,
          isWritable: false,
          // Accounts in address lookup tables can not be signers.
          isSigner: false
        })
      }
    }

    const transactionInstruction = await this.multisig.methods
      .executeTransactionV2()
      .accounts({
        multisig: transaction.ms,
        transaction: transactionPDA,
        member: feePayer,
      })
      .remainingAccounts(remainingAccounts)
      .instruction()

    const { blockhash } = await this.connection.getLatestBlockhash();

    const messageV0 = new TransactionMessage({
      recentBlockhash: blockhash,
      payerKey: feePayer,
      instructions: [transactionInstruction],
    }).compileToV0Message([...addressLookupTableAccounts.values()]);

    return new VersionedTransaction(messageV0);
  }
  // async executeTransactionV2(
  //   transactionPDA: PublicKey,
  //   feePayer?: PublicKey,
  //   signers?: Signer[],
  //   confirmOptions?: ConfirmOptions
  // ): Promise<TransactionV2Account> {
  //   const payer = feePayer ?? this.wallet.publicKey;
  //   const executeIx = await this._buildExecuteTransactionV2(transactionPDA, payer);
  //
  //   const { blockhash } = await this.connection.getLatestBlockhash();
  //   const lastValidBlockHeight = await this.connection.getBlockHeight();
  //   const executeTx = new anchor.web3.Transaction({
  //     blockhash,
  //     lastValidBlockHeight,
  //     feePayer: payer,
  //   });
  //   executeTx.add(executeIx);
  //   await this.provider.sendAndConfirm(executeTx, signers, confirmOptions);
  //   return await this.getTransactionV2(transactionPDA);
  // }
}


function isWritableIndex(message: MsTransactionMessage, index: number) {
  const numAccountKeys = message.accountKeys.length;
  const numSigners = message.numSigners;
  if (index >= numAccountKeys) {
    // Check if the index corresponds to a writable account loaded with a lookup table.
    const loadedAddressesIndex = index - numAccountKeys;
    const numWritableDynamicAddresses = message.addressTableLookups.reduce((sum, {writableIndexes}) => {
        sum += writableIndexes.length;
        return sum;
      }, 0)
    return loadedAddressesIndex < numWritableDynamicAddresses;
  } else if (index >= numSigners) {
    // Check if the account is a writable non-signer.
    const nonSignerAccountIndex = index - numSigners;
    return nonSignerAccountIndex < message.numWritableNonSigners;
  } else {
    // Check if the account is a writable signer.
    return index < message.numWritableSigners;
  }
}

function isSignerIndex(message: MsTransactionMessage, index: number) {
  return index < message.numSigners
}

export default Squads;

export * from "./constants";
export * from "./address";
