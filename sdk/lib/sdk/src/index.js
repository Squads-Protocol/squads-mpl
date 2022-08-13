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
class Squads {
    constructor({ connection, wallet, multisigProgramId, programManagerProgramId, }) {
        this.connection = connection;
        this.wallet = wallet;
        this.multisigProgramId = multisigProgramId !== null && multisigProgramId !== void 0 ? multisigProgramId : constants_1.DEFAULT_MULTISIG_PROGRAM_ID;
        this.provider = new anchor_1.AnchorProvider(this.connection, this.wallet, anchor_1.AnchorProvider.defaultOptions());
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
    getMultisig(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.ms.fetch(address);
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getMultisigs(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.ms.fetchMultiple(addresses);
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getTransaction(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msTransaction.fetch(address);
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getTransactions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msTransaction.fetchMultiple(addresses);
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getInstruction(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msInstruction.fetch(address);
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getInstructions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.multisig.account.msInstruction.fetchMultiple(addresses);
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getProgramManager(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programManager.fetch(address);
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getProgramManagers(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programManager.fetchMultiple(addresses);
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getManagedProgram(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.managedProgram.fetch(address);
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getManagedPrograms(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.managedProgram.fetchMultiple(addresses);
            return this._addPublicKeys(accountData, addresses);
        });
    }
    getProgramUpgrade(address) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programUpgrade.fetch(address);
            return Object.assign(Object.assign({}, accountData), { publicKey: address });
        });
    }
    getProgramUpgrades(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountData = yield this.programManager.account.programUpgrade.fetchMultiple(addresses);
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
    createMultisig(threshold, createKey, initialMembers) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!initialMembers.find((member) => member.equals(this.wallet.publicKey))) {
                initialMembers.push(this.wallet.publicKey);
            }
            const [multisigPDA] = (0, address_1.getMsPDA)(createKey, this.multisigProgramId);
            yield this.multisig.methods
                .create(threshold, createKey, initialMembers)
                .accounts({ multisig: multisigPDA, creator: this.wallet.publicKey })
                .rpc();
            return yield this.getMultisig(multisigPDA);
        });
    }
    createTransaction(multisigPDA, authorityIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const nextTransactionIndex = yield this.getNextTransactionIndex(multisigPDA);
            const [transactionPDA] = (0, address_1.getTxPDA)(multisigPDA, new bn_js_1.default(nextTransactionIndex, 10), this.multisigProgramId);
            yield this.multisig.methods
                .createTransaction(authorityIndex)
                .accounts({
                multisig: multisigPDA,
                transaction: transactionPDA,
                creator: this.wallet.publicKey,
            })
                .rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    addInstruction(transactionPDA, instruction) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const [instructionPDA] = (0, address_1.getIxPDA)(transactionPDA, new bn_js_1.default(transaction.instructionIndex + 1, 10), this.multisigProgramId);
            yield this.multisig.methods
                .addInstruction(instruction)
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                instruction: instructionPDA,
                creator: this.wallet.publicKey,
            })
                .rpc();
            return yield this.getInstruction(instructionPDA);
        });
    }
    activateTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            yield this.multisig.methods
                .activateTransaction()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                creator: this.wallet.publicKey,
            })
                .rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    approveTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            yield this.multisig.methods
                .approveTransaction()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            })
                .rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    rejectTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            yield this.multisig.methods
                .rejectTransaction()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            })
                .rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    cancelTransaction(transactionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            yield this.multisig.methods
                .cancelTransaction()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: this.wallet.publicKey,
            })
                .rpc();
            return yield this.getTransaction(transactionPDA);
        });
    }
    executeTransaction(transactionPDA, feePayer) {
        return __awaiter(this, void 0, void 0, function* () {
            const payer = feePayer !== null && feePayer !== void 0 ? feePayer : this.wallet;
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
                const sig = anchor.utils.sha256.hash("global:add_member");
                const ixDiscriminator = Buffer.from(sig, "hex");
                const data = Buffer.concat([ixDiscriminator.slice(0, 8)]);
                const ixData = ixItem.data;
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
            const { blockhash } = yield this.connection.getLatestBlockhash();
            const lastValidBlockHeight = yield this.connection.getBlockHeight();
            const executeTx = new anchor.web3.Transaction({
                blockhash,
                lastValidBlockHeight,
                feePayer: payer.publicKey,
            });
            const executeIx = yield this.multisig.methods
                .executeTransaction(Buffer.from(keyIndexMap))
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                member: payer.publicKey,
            })
                .instruction();
            executeIx.keys = executeIx.keys.concat(keysUnique);
            executeTx.add(executeIx);
            yield this.provider.sendAndConfirm(executeTx);
            return yield this.getTransaction(transactionPDA);
        });
    }
    executeInstruction(transactionPDA, instructionPDA) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = yield this.getTransaction(transactionPDA);
            const instruction = yield this.getInstruction(instructionPDA);
            const remainingAccountKeys = [
                { pubkey: instruction.programId, isSigner: false, isWritable: false },
            ].concat(instruction.keys.map((key) => (Object.assign(Object.assign({}, key), { isSigner: false }))));
            yield this.multisig.methods
                .executeInstruction()
                .accounts({
                multisig: transaction.ms,
                transaction: transactionPDA,
                instruction: instructionPDA,
                member: this.wallet.publicKey,
            })
                .remainingAccounts(remainingAccountKeys)
                .rpc();
            return yield this.getInstruction(instructionPDA);
        });
    }
    createProgramManager() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    createManagedProgram() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    createProgramUpgrade() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    markUpgradeCompleted() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
}
exports.default = Squads;
__exportStar(require("./constants"), exports);
__exportStar(require("./address"), exports);
