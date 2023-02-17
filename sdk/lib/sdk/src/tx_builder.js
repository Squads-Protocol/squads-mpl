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
exports.TransactionBuilder = void 0;
const address_1 = require("./address");
const bn_js_1 = __importDefault(require("bn.js"));
const anchor = __importStar(require("@coral-xyz/anchor"));
class TransactionBuilder {
    constructor(methods, managerMethods, provider, multisig, authorityIndex, programId, instructions) {
        this.methods = methods;
        this.managerMethods = managerMethods;
        this.provider = provider;
        this.multisig = multisig;
        this.authorityIndex = authorityIndex;
        this.programId = programId;
        this.instructions = instructions !== null && instructions !== void 0 ? instructions : [];
    }
    _buildAddInstruction(transactionPDA, instruction, instructionIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const [instructionPDA] = (0, address_1.getIxPDA)(transactionPDA, new bn_js_1.default(instructionIndex, 10), this.programId);
            return yield this.methods
                .addInstruction(instruction)
                .accounts({
                multisig: this.multisig.publicKey,
                transaction: transactionPDA,
                instruction: instructionPDA,
                creator: this.provider.wallet.publicKey,
            })
                .instruction();
        });
    }
    _cloneWithInstructions(instructions) {
        return new TransactionBuilder(this.methods, this.managerMethods, this.provider, this.multisig, this.authorityIndex, this.programId, instructions);
    }
    transactionPDA() {
        const [transactionPDA] = (0, address_1.getTxPDA)(this.multisig.publicKey, new bn_js_1.default(this.multisig.transactionIndex + 1), this.programId);
        return transactionPDA;
    }
    withInstruction(instruction) {
        return this._cloneWithInstructions(this.instructions.concat(instruction));
    }
    withInstructions(instructions) {
        const newInstructions = [];
        for (let i = 0; i < instructions.length; i++) {
            newInstructions.push(instructions[i]);
        }
        return this._cloneWithInstructions(this.instructions.concat(newInstructions));
    }
    withAddMember(member) {
        return __awaiter(this, void 0, void 0, function* () {
            const instructions = [];
            const instruction = yield this.methods
                .addMember(member)
                .accounts({
                multisig: this.multisig.publicKey,
            })
                .instruction();
            instructions.push(instruction);
            return this._cloneWithInstructions(this.instructions.concat(instructions));
        });
    }
    withAddMemberAndChangeThreshold(member, threshold) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = yield this.methods
                .addMemberAndChangeThreshold(member, threshold)
                .accounts({
                multisig: this.multisig.publicKey,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    withRemoveMember(member) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = yield this.methods
                .removeMember(member)
                .accounts({
                multisig: this.multisig.publicKey,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    withRemoveMemberAndChangeThreshold(member, threshold) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = yield this.methods
                .removeMemberAndChangeThreshold(member, threshold)
                .accounts({
                multisig: this.multisig.publicKey,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    withChangeThreshold(threshold) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = yield this.methods
                .changeThreshold(threshold)
                .accounts({
                multisig: this.multisig.publicKey,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    // async withAddAuthority(): Promise<TransactionBuilder> {}
    // async withSetExternalExecute(): Promise<TransactionBuilder> {}
    withSetAsExecuted(programManagerPDA, managedProgramPDA, programUpgradePDA, transactionPDA, instructionPDA, authorityIndex) {
        return __awaiter(this, void 0, void 0, function* () {
            const [authorityPDA] = (0, address_1.getAuthorityPDA)(this.multisig.publicKey, new bn_js_1.default(authorityIndex, 10), this.programId);
            const instruction = yield this.managerMethods
                .setAsExecuted()
                .accounts({
                multisig: this.multisig.publicKey,
                programManager: programManagerPDA,
                managedProgram: managedProgramPDA,
                programUpgrade: programUpgradePDA,
                transaction: transactionPDA,
                instruction: instructionPDA,
                authority: authorityPDA,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    getInstructions() {
        return __awaiter(this, void 0, void 0, function* () {
            const transactionPDA = this.transactionPDA();
            const wrappedAddInstructions = yield Promise.all(this.instructions.map((rawInstruction, index) => this._buildAddInstruction(transactionPDA, rawInstruction, index + 1)));
            const createTxInstruction = yield this.methods
                .createTransaction(this.authorityIndex)
                .accounts({
                multisig: this.multisig.publicKey,
                transaction: transactionPDA,
                creator: this.provider.wallet.publicKey,
            })
                .instruction();
            const instructions = [createTxInstruction, ...wrappedAddInstructions];
            this.instructions = [];
            return [instructions, transactionPDA];
        });
    }
    executeInstructions() {
        return __awaiter(this, void 0, void 0, function* () {
            const [instructions, transactionPDA] = yield this.getInstructions();
            const { blockhash } = yield this.provider.connection.getLatestBlockhash();
            const lastValidBlockHeight = yield this.provider.connection.getBlockHeight();
            const transaction = new anchor.web3.Transaction({
                blockhash,
                lastValidBlockHeight,
                feePayer: this.provider.wallet.publicKey,
            });
            transaction.add(...instructions);
            yield this.provider.sendAndConfirm(transaction);
            return [instructions, transactionPDA];
        });
    }
}
exports.TransactionBuilder = TransactionBuilder;
