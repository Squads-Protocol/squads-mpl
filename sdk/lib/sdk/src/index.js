"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@solana/web3.js");
const constants_1 = require("./constants");
const squads_mpl_json_1 = __importDefault(require("../../target/idl/squads_mpl.json"));
const program_manager_json_1 = __importDefault(require("../../target/idl/program_manager.json"));
const anchor_1 = require("@project-serum/anchor");
const address_1 = require("./address");
const bn_js_1 = __importDefault(require("bn.js"));
const anchor = __importStar(require("@project-serum/anchor"));
const tx_builder_1 = require("./tx_builder");
const beets_1 = require("./beets");
class Squads {
    constructor({ connection, wallet, multisigProgramId, programManagerProgramId, }) {
        this.connection = connection;
        this.wallet = wallet;
        this.multisigProgramId = multisigProgramId !== null && multisigProgramId !== void 0 ? multisigProgramId : constants_1.DEFAULT_MULTISIG_PROGRAM_ID;
        this.provider = new anchor_1.AnchorProvider(this.connection, this.wallet, Object.assign(Object.assign({}, anchor_1.AnchorProvider.defaultOptions()), { commitment: "confirmed", preflightCommitment: "confirmed" }));
        this.multisig = new anchor_1.Program(squads_mpl_json_1.default, this.multisigProgramId, this.provider);
        this.programManagerProgramId =
            programManagerProgramId !== null && programManagerProgramId !== void 0 ? programManagerProgramId : constants_1.DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
        this.programManager = new anchor_1.Program(program_manager_json_1.default, this.programManagerProgramId, this.provider);
    }
    static endpoint(endpoint, wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection(endpoint, options === null || options === void 0 ? void 0 : options.commitmentOrConfig), wallet }, options));
    }
    static mainnet(wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("https://api.mainnet-beta.solana.com", options === null || options === void 0 ? void 0 : options.commitmentOrConfig), wallet }, options));
    }
    static devnet(wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("https://api.devnet.solana.com", options === null || options === void 0 ? void 0 : options.commitmentOrConfig), wallet }, options));
    }
    static localnet(wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("http://localhost:8899", options === null || options === void 0 ? void 0 : options.commitmentOrConfig), wallet }, options));
    }
    _addPublicKeys(items, addresses) {
        return items.map((item, index) => item ? Object.assign(Object.assign({}, item), { publicKey: addresses[index] }) : null);
    }
    getTransactionBuilder(multisigPDA, authorityIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const multisig = yield this.getMultisig(multisigPDA);
            return new tx_builder_1.TransactionBuilder(this.multisig.methods, this.programManager.methods, this.provider, multisig, authorityIndex, this.multisigProgramId);
        });
    }
    getMultisig(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.ms.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getMultisigs(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.ms.fetchMultiple(addresses, "processed");
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getTransaction(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msTransaction.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getTransactionV2(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msTransactionV2.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getTransactions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msTransaction.fetchMultiple(addresses, "processed");
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getInstruction(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msInstruction.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getInstructions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msInstruction.fetchMultiple(addresses, "processed");
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getProgramManager(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programManager.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getProgramManagers(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programManager.fetchMultiple(addresses, "processed");
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getManagedProgram(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.managedProgram.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getManagedPrograms(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.managedProgram.fetchMultiple(addresses, "processed");
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getProgramUpgrade(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programUpgrade.fetch(address, "processed");
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getProgramUpgrades(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programUpgrade.fetchMultiple(addresses, "processed");
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getNextTransactionIndex(multisigPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const multisig = yield this.getMultisig(multisigPDA);
            return multisig.transactionIndex + 1;
        });
    }
    getNextInstructionIndex(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            return transaction.instructionIndex + 1;
        });
    }
    getNextProgramIndex(programManagerPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const programManager = yield this.getProgramManager(programManagerPDA);
            return programManager.managedProgramIndex + 1;
        });
    }
    getNextUpgradeIndex(managedProgramPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const managedProgram = yield this.getManagedProgram(managedProgramPDA);
            return managedProgram.upgradeIndex + 1;
        });
    }
    getAuthorityPDA(multisigPDA, authorityIndex) {
        return (0, address_1.getAuthorityPDA)(multisigPDA, new bn_js_1.default(authorityIndex, 10), this.multisigProgramId)[0];
    }
    _createMultisig(threshold, createKey, initialMembers) {
        if (!initialMembers.find((member) => member.equals(this.wallet.publicKey))) {
            initialMembers.push(this.wallet.publicKey);
        }
        const [multisigPDA] = (0, address_1.getMsPDA)(createKey, this.multisigProgramId);
        return [
            this.multisig.methods
                .create(threshold, createKey, initialMembers)
                .accounts({ multisig: multisigPDA, creator: this.wallet.publicKey }),
            multisigPDA,
        ];
    }
    createMultisig(threshold, createKey, initialMembers) {
        return __awaiter(this, void 0, void 0, function* () {
            const [methods, multisigPDA] = this._createMultisig(threshold, createKey, initialMembers);
            yield methods.rpc();
            return yield this.getMultisig(multisigPDA);
        });
    }
    buildCreateMultisig(threshold, createKey, initialMembers) {
        return __awaiter(this, void 0, void 0, function* () {
            const [methods] = this._createMultisig(threshold, createKey, initialMembers);
            return yield methods.instruction();
        });
    }
    _createTransaction(multisigPDA, authorityIndex, transactionIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const [transactionPDA] = (0, address_1.getTxPDA)(multisigPDA, new bn_js_1.default(transactionIndex, 10), this.multisigProgramId);
            return [
                this.multisig.methods.createTransaction(authorityIndex).accounts({
                    multisig: multisigPDA,
                    transaction: transactionPDA,
                    creator: this.wallet.publicKey,
                }),
                transactionPDA,
            ];
        });
    }
    createTransaction(multisigPDA, authorityIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const nextTransactionIndex = yield this.getNextTransactionIndex(multisigPDA);
            const [methods, transactionPDA] = yield this._createTransaction(multisigPDA, authorityIndex, nextTransactionIndex);
            yield methods.rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    buildCreateTransaction(multisigPDA, authorityIndex, transactionIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const [methods] = yield this._createTransaction(multisigPDA, authorityIndex, transactionIndex);
            return yield methods.instruction();
        });
    }
    buildCreateTransactionV2(multisigPDA, authorityIndex, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const nextTransactionIndex = yield this.getNextTransactionIndex(multisigPDA);
            const [transactionPDA] = (0, address_1.getTxPDA)(multisigPDA, new bn_js_1.default(nextTransactionIndex, 10), this.multisigProgramId);
            const createTxInstruction = yield this._buildCreateTransactionV2(multisigPDA, transactionPDA, authorityIndex, message);
            return [createTxInstruction, transactionPDA];
        });
    }
    _buildCreateTransactionV2(multisigPDA, transactionPDA, authorityIndex, message) {
        return __awaiter(this, void 0, void 0, function* () {
            const allResolvableIndexes = new Set([
                ...message.staticAccountKeys,
                ...message.addressTableLookups.flatMap((a) => [...a.writableIndexes, ...a.readonlyIndexes]),
            ]);
            const [transactionMessageBytes] = beets_1.transactionMessageBeet.serialize({
                numSigners: message.header.numRequiredSignatures,
                numWritableSigners: message.header.numRequiredSignatures - message.header.numReadonlySignedAccounts,
                numWritableNonSigners: message.staticAccountKeys.length - message.header.numRequiredSignatures - message.header.numReadonlyUnsignedAccounts,
                accountKeys: message.staticAccountKeys,
                instructions: message.compiledInstructions.map((ix) => {
                    return {
                        programIdIndex: ix.programIdIndex,
                        // This is a temporary hack, MessageV0 shouldn't include into `instruction.accountKeyIndexes` ones
                        // that are neither in `accountKeys` nor in `addressTableLookups`.
                        accountIndexes: ix.accountKeyIndexes.filter((i) => allResolvableIndexes.has(i)),
                        data: Array.from(ix.data),
                    };
                }),
                addressTableLookups: message.addressTableLookups,
            });
            return yield this.multisig.methods.createTransactionV2(authorityIndex, transactionMessageBytes)
                .accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                creator: this.provider.wallet.publicKey,
            })
                .instruction();
        });
    }
    _addInstruction(multisigPDA, transactionPDA, instruction, instructionIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const [instructionPDA] = (0, address_1.getIxPDA)(transactionPDA, new bn_js_1.default(instructionIndex, 10), this.multisigProgramId);
            return [
                this.multisig.methods.addInstruction(instruction).accounts({
                    multisig: multisigPDA,
                    transaction: transactionPDA,
                    instruction: instructionPDA,
                    creator: this.wallet.publicKey,
                }),
                instructionPDA,
            ];
        });
    }
    addInstruction(transactionPDA, instruction) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const [methods, instructionPDA] = yield this._addInstruction(transaction.ms, transactionPDA, instruction, transaction.instructionIndex + 1);
            yield methods.rpc();
            return yield this.getInstruction(instructionPDA);
        });
    }
    buildAddInstruction(multisigPDA, transactionPDA, instruction, instructionIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const [methods] = yield this._addInstruction(multisigPDA, transactionPDA, instruction, instructionIndex);
            return yield methods.instruction();
        });
    }
    _activateTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.multisig.methods.activateTransaction().accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                creator: this.wallet.publicKey,
            });
        });
    }
    activateTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const methods = yield this._activateTransaction(transaction.ms, transactionPDA);
            yield methods.rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    buildActivateTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const methods = yield this._activateTransaction(multisigPDA, transactionPDA);
            return yield methods.instruction();
        });
    }
    _approveTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.multisig.methods.approveTransaction().accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            });
        });
    }
    _approveTransactionV2(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.multisig.methods.approveTransactionV2().accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            });
        });
    }
    approveTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const methods = yield this._approveTransaction(transaction.ms, transactionPDA);
            yield methods.rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    approveTransactionV2(transactionPDA, confirmOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransactionV2(transactionPDA);
            const methods = yield this._approveTransactionV2(transaction.ms, transactionPDA);
            yield methods.rpc(confirmOptions);
            return yield this.getTransactionV2(transactionPDA);
        });
    }
    buildApproveTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const methods = yield this._approveTransaction(multisigPDA, transactionPDA);
            return yield methods.instruction();
        });
    }
    _rejectTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.multisig.methods.rejectTransaction().accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            });
        });
    }
    rejectTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const methods = yield this._rejectTransaction(transaction.ms, transactionPDA);
            yield methods.rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    buildRejectTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const methods = yield this._rejectTransaction(multisigPDA, transactionPDA);
            return yield methods.instruction();
        });
    }
    _cancelTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            return this.multisig.methods.cancelTransaction().accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            });
        });
    }
    cancelTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const methods = yield this._cancelTransaction(transaction.ms, transactionPDA);
            yield methods.rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    buildCancelTransaction(multisigPDA, transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const methods = yield this._cancelTransaction(multisigPDA, transactionPDA);
            return yield methods.instruction();
        });
    }
    _executeTransaction(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const ixList = yield Promise.all([...new Array(transaction.instructionIndex)].map((a, i) => __awaiter(this, void 0, void 0, function* () {
                const ixIndexBN = new anchor.BN(i + 1, 10);
                const [ixKey] = (0, address_1.getIxPDA)(transactionPDA, ixIndexBN, this.multisigProgramId);
                const ixAccount = yield this.getInstruction(ixKey);
                return { pubkey: ixKey, ixItem: ixAccount };
            })));
            const ixKeysList = ixList
                .map(({ pubkey, ixItem }) => {
                const ixKeys = ixItem.keys;
                const addSig = anchor.utils.sha256.hash("global:add_member");
                const ixDiscriminator = Buffer.from(addSig, "hex");
                const addData = Buffer.concat([ixDiscriminator.slice(0, 8)]);
                const addAndThreshSig = anchor.utils.sha256.hash("global:add_member_and_change_threshold");
                const ixAndThreshDiscriminator = Buffer.from(addAndThreshSig, "hex");
                const addAndThreshData = Buffer.concat([
                    ixAndThreshDiscriminator.slice(0, 8),
                ]);
                const ixData = ixItem.data;
                const formattedKeys = ixKeys.map((ixKey, keyInd) => {
                    if ((ixData.includes(addData) || ixData.includes(addAndThreshData)) &&
                        keyInd === 2) {
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
                ];
            })
                .reduce((p, c) => p.concat(c), []);
            //  [ix ix_account, ix program_id, key1, key2 ...]
            const keysUnique = ixKeysList.reduce((prev, curr) => {
                const inList = prev.findIndex((a) => a.pubkey.toBase58() === curr.pubkey.toBase58());
                // if its already in the list, and has same write flag
                if (inList >= 0 && prev[inList].isWritable === curr.isWritable) {
                    return prev;
                }
                else {
                    prev.push({
                        pubkey: curr.pubkey,
                        isWritable: curr.isWritable,
                        isSigner: curr.isSigner,
                    });
                    return prev;
                }
            }, []);
            const keyIndexMap = ixKeysList.map((a) => {
                return keysUnique.findIndex((k) => k.pubkey.toBase58() === a.pubkey.toBase58() &&
                    k.isWritable === a.isWritable);
            });
            const executeIx = yield this.multisig.methods
                .executeTransaction(Buffer.from(keyIndexMap))
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: feePayer,
            })
                .instruction();
            executeIx.keys = executeIx.keys.concat(keysUnique);
            return executeIx;
        });
    }
    executeTransaction(transactionPDA, feePayer, signers) {
        return __awaiter(this, void 0, void 0, function* () {
            const payer = feePayer !== null && feePayer !== void 0 ? feePayer : this.wallet.publicKey;
            const executeIx = yield this._executeTransaction(transactionPDA, payer);
            const { blockhash } = yield this.connection.getLatestBlockhash();
            const lastValidBlockHeight = yield this.connection.getBlockHeight();
            const executeTx = new anchor.web3.Transaction({
                blockhash,
                lastValidBlockHeight,
                feePayer: payer,
            });
            executeTx.add(executeIx);
            yield this.provider.sendAndConfirm(executeTx, signers);
            return yield this.getTransaction(transactionPDA);
        });
    }
    _buildExecuteTransactionV2(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransactionV2(transactionPDA);
            const authorityPda = this.getAuthorityPDA(transaction.ms, transaction.authorityIndex);
            const addressLookupTableKeys = transaction.message.addressTableLookups.map(({ accountKey }) => accountKey);
            const addressLookupTableAccounts = yield Promise.all(addressLookupTableKeys.map((key) => __awaiter(this, void 0, void 0, function* () {
                const { value } = yield this.connection.getAddressLookupTable(key);
                if (!value) {
                    throw new Error(`Address lookup table account ${key.toBase58()} not found`);
                }
                return value;
            })));
            // Populate remaining accounts required for execution of the transaction.
            const remainingAccounts = [];
            for (const ix of transaction.message.instructions) {
                const programId = transaction.message.accountKeys[ix.programIdIndex];
                if (!remainingAccounts.find(k => k.pubkey.equals(programId))) {
                    remainingAccounts.push({ pubkey: programId, isSigner: false, isWritable: false });
                }
                for (const accountIndex of ix.accountIndexes) {
                    let accountKey = undefined;
                    if (accountIndex >= transaction.message.accountKeys.length) {
                        let cursorIndex = transaction.message.accountKeys.length;
                        for (const lookup of transaction.message.addressTableLookups) {
                            let indexes = [...lookup.writableIndexes, ...lookup.readonlyIndexes];
                            const found = indexes.find((index) => index === accountIndex);
                            if (found) {
                                const addressLookupTableAccount = addressLookupTableAccounts.find((account) => account.key.equals(lookup.accountKey));
                                if (!addressLookupTableAccount) {
                                    throw new Error(`Address lookup table account ${lookup.accountKey.toBase58()} not found`);
                                }
                                const lookupIndex = accountIndex - cursorIndex;
                                accountKey = addressLookupTableAccount.state.addresses[lookupIndex];
                                break;
                            }
                            cursorIndex += indexes.length;
                        }
                    }
                    else {
                        accountKey = transaction.message.accountKeys[accountIndex];
                    }
                    if (!accountKey) {
                        throw new Error(`Account key not found for index ${accountIndex}`);
                    }
                    const accountMeta = {
                        pubkey: accountKey,
                        // FIXME: Take the ATLs into account.
                        isWritable: accountIndex < transaction.message.numWritableSigners
                            || (accountIndex >= transaction.message.numSigners && accountIndex < (transaction.message.numSigners + transaction.message.numWritableNonSigners)),
                        // NOTE: authorityPda cannot be marked as signer because it's a PDA.
                        isSigner: accountIndex < transaction.message.numSigners && !accountKey.equals(authorityPda)
                    };
                    const foundMeta = remainingAccounts.find(k => k.pubkey.equals(accountKey));
                    if (!foundMeta) {
                        remainingAccounts.push(accountMeta);
                    }
                    else {
                        foundMeta.isSigner || (foundMeta.isSigner = accountMeta.isSigner);
                        foundMeta.isWritable || (foundMeta.isWritable = accountMeta.isWritable);
                    }
                }
            }
            const transactionInstruction = yield this.multisig.methods
                .executeTransactionV2()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: feePayer,
            })
                .remainingAccounts(remainingAccounts)
                .instruction();
            const { blockhash } = yield this.connection.getLatestBlockhash();
            const messageV0 = new web3_js_1.TransactionMessage({
                recentBlockhash: blockhash,
                payerKey: feePayer,
                instructions: [transactionInstruction],
            }).compileToV0Message(addressLookupTableAccounts);
            return new web3_js_1.VersionedTransaction(messageV0);
        });
    }
    buildExecuteTransactionV2(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const payer = feePayer !== null && feePayer !== void 0 ? feePayer : this.wallet.publicKey;
            return yield this._buildExecuteTransactionV2(transactionPDA, payer);
        });
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
    buildExecuteTransaction(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const payer = feePayer !== null && feePayer !== void 0 ? feePayer : this.wallet.publicKey;
            return yield this._executeTransaction(transactionPDA, payer);
        });
    }
    _executeInstruction(transactionPDA, instructionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const instruction = yield this.getInstruction(instructionPDA);
            const remainingAccountKeys = [
                { pubkey: instruction.programId, isSigner: false, isWritable: false },
            ].concat(instruction.keys.map((key) => (Object.assign(Object.assign({}, key), { isSigner: false }))));
            return this.multisig.methods
                .executeInstruction()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                instruction: instructionPDA,
                member: this.wallet.publicKey,
            })
                .remainingAccounts(remainingAccountKeys);
        });
    }
    executeInstruction(transactionPDA, instructionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const methods = yield this._executeInstruction(transactionPDA, instructionPDA);
            yield methods.rpc();
            return yield this.getInstruction(instructionPDA);
        });
    }
    buildExecuteInstruction(transactionPDA, instructionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const methods = yield this._executeInstruction(transactionPDA, instructionPDA);
            return yield methods.instruction();
        });
    }
    createProgramManager(multisigPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const [programManagerPDA] = (0, address_1.getProgramManagerPDA)(multisigPDA, this.programManagerProgramId);
            yield this.programManager.methods
                .createProgramManager()
                .accounts({ multisig: multisigPDA, programManager: programManagerPDA })
                .rpc();
            return yield this.getProgramManager(programManagerPDA);
        });
    }
    createManagedProgram(multisigPDA, programAddress, name) {
        return __awaiter(this, void 0, void 0, function* () {
            const [programManagerPDA] = (0, address_1.getProgramManagerPDA)(multisigPDA, this.programManagerProgramId);
            const [managedProgramPDA] = (0, address_1.getManagedProgramPDA)(programManagerPDA, new bn_js_1.default(yield this.getNextProgramIndex(programManagerPDA), 10), this.programManagerProgramId);
            yield this.programManager.methods
                .createManagedProgram(programAddress, name)
                .accounts({
                multisig: multisigPDA,
                programManager: programManagerPDA,
                managedProgram: managedProgramPDA,
            })
                .rpc();
            return yield this.getManagedProgram(managedProgramPDA);
        });
    }
    createProgramUpgrade(multisigPDA, managedProgramPDA, bufferAddress, spillAddress, authorityAddress, upgradeName) {
        return __awaiter(this, void 0, void 0, function* () {
            const [programManagerPDA] = (0, address_1.getProgramManagerPDA)(multisigPDA, this.programManagerProgramId);
            const [programUpgradePDA] = (0, address_1.getProgramUpgradePDA)(managedProgramPDA, new bn_js_1.default(yield this.getNextUpgradeIndex(managedProgramPDA), 10), this.programManagerProgramId);
            yield this.programManager.methods
                .createProgramUpgrade(bufferAddress, spillAddress, authorityAddress, upgradeName)
                .accounts({
                multisig: multisigPDA,
                programManager: programManagerPDA,
                managedProgram: managedProgramPDA,
                programUpgrade: programUpgradePDA,
            })
                .rpc();
            return yield this.getProgramUpgrade(programUpgradePDA);
        });
    }
}
exports.default = Squads;
__exportStar(require("./constants"), exports);
__exportStar(require("./address"), exports);
