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
const assert = __importStar(require("assert"));
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
    _createMultisig(threshold, createKey, initialMembers, name, description = "", image = "") {
        if (!initialMembers.find((member) => member.equals(this.wallet.publicKey))) {
            initialMembers.push(this.wallet.publicKey);
        }
        const [multisigPDA] = (0, address_1.getMsPDA)(createKey, this.multisigProgramId);
        return [
            this.multisig.methods
                .create(threshold, createKey, initialMembers, JSON.stringify({ name, description, image }))
                .accounts({ multisig: multisigPDA, creator: this.wallet.publicKey }),
            multisigPDA,
        ];
    }
    createMultisig(threshold, createKey, initialMembers, name, description = "", image = "") {
        return __awaiter(this, void 0, void 0, function* () {
            const [methods, multisigPDA] = this._createMultisig(threshold, createKey, initialMembers, JSON.stringify({ name, description, image }));
            yield methods.rpc();
            return yield this.getMultisig(multisigPDA);
        });
    }
    buildCreateMultisig(threshold, createKey, initialMembers, name, description = "", image = "") {
        return __awaiter(this, void 0, void 0, function* () {
            const [methods] = this._createMultisig(threshold, createKey, initialMembers, JSON.stringify({ name, description, image }));
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
    approveTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const methods = yield this._approveTransaction(transaction.ms, transactionPDA);
            yield methods.rpc();
            return yield this.getTransaction(transactionPDA);
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
    buildCreateTransactionV2(multisigPDA, authorityIndex, message, addressLookupTableAccounts) {
        return __awaiter(this, void 0, void 0, function* () {
            // .compileToV0Message([alt.value]);
            // console.log("message.staticAccountKeys", JSON.stringify(testTransferMessageV0.staticAccountKeys, null, 2))
            // console.log("message.addressTableLookups:", JSON.stringify(testTransferMessageV0.addressTableLookups, null, 2))
            const nextTransactionIndex = yield this.getNextTransactionIndex(multisigPDA);
            const [transactionPDA] = (0, address_1.getTxPDA)(multisigPDA, new bn_js_1.default(nextTransactionIndex, 10), this.multisigProgramId);
            const createTxInstruction = yield this._buildCreateTransactionV2(multisigPDA, transactionPDA, authorityIndex, message, addressLookupTableAccounts);
            return [createTxInstruction, transactionPDA];
        });
    }
    _buildCreateTransactionV2(multisigPDA, transactionPDA, authorityIndex, message, addressLookupTableAccounts) {
        return __awaiter(this, void 0, void 0, function* () {
            const authorityPDA = yield this.getAuthorityPDA(multisigPDA, authorityIndex);
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
            const [transactionMessageBytes] = beets_1.transactionMessageBeet.serialize({
                numSigners: compiledMessage.header.numRequiredSignatures,
                numWritableSigners: compiledMessage.header.numRequiredSignatures - compiledMessage.header.numReadonlySignedAccounts,
                numWritableNonSigners: compiledMessage.staticAccountKeys.length - compiledMessage.header.numRequiredSignatures - compiledMessage.header.numReadonlyUnsignedAccounts,
                accountKeys: compiledMessage.staticAccountKeys,
                instructions: compiledMessage.compiledInstructions.map((ix) => {
                    return {
                        programIdIndex: ix.programIdIndex,
                        accountIndexes: ix.accountKeyIndexes,
                        data: Array.from(ix.data),
                    };
                }),
                addressTableLookups: compiledMessage.addressTableLookups,
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
    buildApproveTransactionV2(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransactionV2(transactionPDA);
            return yield this.multisig.methods.approveTransactionV2().accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            }).instruction();
        });
    }
    approveTransactionV2(transactionPDA, confirmOptions) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransactionV2(transactionPDA);
            yield this.multisig.methods.approveTransactionV2().accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            }).rpc(confirmOptions);
            return yield this.getTransactionV2(transactionPDA);
        });
    }
    buildExecuteTransactionV2(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const payer = feePayer !== null && feePayer !== void 0 ? feePayer : this.wallet.publicKey;
            return yield this._buildExecuteTransactionV2(transactionPDA, payer);
        });
    }
    _buildExecuteTransactionV2(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransactionV2(transactionPDA);
            const authorityPda = this.getAuthorityPDA(transaction.ms, transaction.authorityIndex);
            const message = transaction.message;
            const addressLookupTableKeys = message.addressTableLookups.map(({ accountKey }) => accountKey);
            const addressLookupTableAccounts = new Map(yield Promise.all(addressLookupTableKeys.map((key) => __awaiter(this, void 0, void 0, function* () {
                const { value } = yield this.connection.getAddressLookupTable(key);
                if (!value) {
                    throw new Error(`Address lookup table account ${key.toBase58()} not found`);
                }
                return [key.toBase58(), value];
            }))));
            // Populate remaining accounts required for execution of the transaction.
            const remainingAccounts = [];
            // First add the lookup table accounts used by the transaction. They are needed for on-chain validation.
            remainingAccounts.push(...addressLookupTableKeys.map((key) => {
                return { pubkey: key, isSigner: false, isWritable: false };
            }));
            // Then add static account keys included into the message.
            for (const [accountIndex, accountKey] of message.accountKeys.entries()) {
                remainingAccounts.push({
                    pubkey: accountKey,
                    isWritable: isWritableIndex(message, accountIndex),
                    // NOTE: authorityPda cannot be marked as signer because it's a PDA.
                    isSigner: isSignerIndex(message, accountIndex) && !accountKey.equals(authorityPda)
                });
            }
            // Then add accounts that will be loaded with address lookup tables.
            for (const lookup of message.addressTableLookups) {
                const lookupTableAccount = addressLookupTableAccounts.get(lookup.accountKey.toBase58());
                assert.ok(lookupTableAccount, `Address lookup table account ${lookup.accountKey.toBase58()} not found`);
                for (const accountIndex of lookup.writableIndexes) {
                    const pubkey = lookupTableAccount.state.addresses[accountIndex];
                    assert.ok(pubkey, `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`);
                    remainingAccounts.push({
                        pubkey,
                        isWritable: true,
                        // Accounts in address lookup tables can not be signers.
                        isSigner: false
                    });
                }
                for (const accountIndex of lookup.readonlyIndexes) {
                    const pubkey = lookupTableAccount.state.addresses[accountIndex];
                    assert.ok(pubkey, `Address lookup table account ${lookup.accountKey.toBase58()} does not contain address at index ${accountIndex}`);
                    remainingAccounts.push({
                        pubkey,
                        isWritable: false,
                        // Accounts in address lookup tables can not be signers.
                        isSigner: false
                    });
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
            }).compileToV0Message([...addressLookupTableAccounts.values()]);
            return new web3_js_1.VersionedTransaction(messageV0);
        });
    }
}
function isWritableIndex(message, index) {
    const numAccountKeys = message.accountKeys.length;
    const numSigners = message.numSigners;
    if (index >= numAccountKeys) {
        // Check if the index corresponds to a writable account loaded with a lookup table.
        const loadedAddressesIndex = index - numAccountKeys;
        const numWritableDynamicAddresses = message.addressTableLookups.reduce((sum, { writableIndexes }) => {
            sum += writableIndexes.length;
            return sum;
        }, 0);
        return loadedAddressesIndex < numWritableDynamicAddresses;
    }
    else if (index >= numSigners) {
        // Check if the account is a writable non-signer.
        const nonSignerAccountIndex = index - numSigners;
        return nonSignerAccountIndex < message.numWritableNonSigners;
    }
    else {
        // Check if the account is a writable signer.
        return index < message.numWritableSigners;
    }
}
function isSignerIndex(message, index) {
    return index < message.numSigners;
}
exports.default = Squads;
__exportStar(require("./constants"), exports);
__exportStar(require("./address"), exports);
