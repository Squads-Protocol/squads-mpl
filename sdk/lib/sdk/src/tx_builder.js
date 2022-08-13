"use strict";
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
class TransactionBuilder {
    constructor(methods, provider, multisig, authorityIndex, programId, instructions) {
        this.methods = methods;
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
        return new TransactionBuilder(this.methods, this.provider, this.multisig, this.authorityIndex, this.programId, instructions);
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
            const instruction = yield this.methods
                .addMember(member)
                .accounts({
                multisig: this.multisig.publicKey,
                multisigAuth: this.multisig.publicKey,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    // async withAddMemberAndChangeThreshold(): Promise<TransactionBuilder> {}
    // async withRemoveMember(): Promise<TransactionBuilder> {}
    // async withRemoveMemberAndChangeThreshold(): Promise<TransactionBuilder> {}
    withChangeThreshold(threshold) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = yield this.methods
                .changeThreshold(threshold)
                .accounts({
                multisig: this.multisig.publicKey,
                multisigAuth: this.multisig.publicKey,
            })
                .instruction();
            return this.withInstruction(instruction);
        });
    }
    // async withAddAuthority(): Promise<TransactionBuilder> {}
    // async withSetExternalExecute(): Promise<TransactionBuilder> {}
    getInstructions() {
        return __awaiter(this, void 0, void 0, function* () {
            const [transactionPDA] = (0, address_1.getTxPDA)(this.multisig.publicKey, new bn_js_1.default(this.multisig.transactionIndex + 1), this.programId);
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
            return [instructions, transactionPDA];
        });
    }
}
exports.TransactionBuilder = TransactionBuilder;
