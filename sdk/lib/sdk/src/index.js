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
class Squads {
    constructor({ connection, wallet, multisigProgramId, programManagerProgramId, }) {
        this.connection = connection;
        this.wallet = wallet;
        this.multisigProgramId = multisigProgramId !== null && multisigProgramId !== void 0 ? multisigProgramId : constants_1.DEFAULT_MULTISIG_PROGRAM_ID;
        this.multisig = new anchor_1.Program(squads_mpl_json_1.default, this.multisigProgramId, new anchor_1.AnchorProvider(this.connection, this.wallet, anchor_1.AnchorProvider.defaultOptions()));
        this.programManagerProgramId =
            programManagerProgramId !== null && programManagerProgramId !== void 0 ? programManagerProgramId : constants_1.DEFAULT_PROGRAM_MANAGER_PROGRAM_ID;
        this.programManager = new anchor_1.Program(program_manager_json_1.default, this.programManagerProgramId, new anchor_1.AnchorProvider(this.connection, this.wallet, anchor_1.AnchorProvider.defaultOptions()));
    }
    static endpoint(endpoint, wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection(endpoint), wallet }, options));
    }
    static mainnet(wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("https://api.mainnet-beta.solana.com"), wallet }, options));
    }
    static devnet(wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("https://api.devnet.solana.com"), wallet }, options));
    }
    static localnet(wallet, options) {
        return new Squads(Object.assign({ connection: new web3_js_1.Connection("http://localhost:8899"), wallet }, options));
    }
    getMultisig(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.multisig.account.ms.fetch(address));
        });
    }
    getMultisigs(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.multisig.account.ms.fetchMultiple(addresses));
        });
    }
    getTransaction(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.multisig.account.msTransaction.fetch(address);
        });
    }
    getTransactions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.multisig.account.msTransaction.fetchMultiple(addresses));
        });
    }
    getInstruction(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.multisig.account.msInstruction.fetch(address);
        });
    }
    getInstructions(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.multisig.account.msInstruction.fetchMultiple(addresses));
        });
    }
    getProgramManager(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.programManager.account.programManager.fetch(address);
        });
    }
    getProgramManagers(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.programManager.account.programManager.fetchMultiple(addresses));
        });
    }
    getManagedProgram(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.programManager.account.managedProgram.fetch(address);
        });
    }
    getManagedPrograms(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.programManager.account.managedProgram.fetchMultiple(addresses));
        });
    }
    getProgramUpgrade(address) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.programManager.account.programUpgrade.fetch(address);
        });
    }
    getProgramUpgrades(addresses) {
        return __awaiter(this, void 0, void 0, function* () {
            return (yield this.programManager.account.programUpgrade.fetchMultiple(addresses));
        });
    }
    createMultisig() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    createTransaction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    addInstruction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    activateTransaction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    approveTransaction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    rejectTransaction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    cancelTransaction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    executeTransaction() {
        return __awaiter(this, void 0, void 0, function* () { });
    }
    executeInstruction() {
        return __awaiter(this, void 0, void 0, function* () { });
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
