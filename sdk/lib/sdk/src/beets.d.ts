import { Beet, FixableBeet, FixedSizeBeet } from "@metaplex-foundation/beet";
import * as beet from "@metaplex-foundation/beet";
import { PublicKey } from "@solana/web3.js";
/**
 * De/Serializes a small array with configurable length prefix and a specific number of elements of type {@link T}
 * which do not all have the same size.
 *
 * @template T type of elements held in the array
 *
 * @param lengthBeet the De/Serializer for the array length prefix
 * @param elements the De/Serializers for the element types
 * @param elementsByteSize size of all elements in the array combined
 *
 * The implementation is minor modification of `fixedSizeArray` where the length is encoded as `lengthBeet.byteSize` bytes:
 * https://github.dev/metaplex-foundation/beet/blob/e053b7b5b0c46ce7f6906ecd38be9fd85d6e5254/beet/src/beets/collections.ts#L84
 */
export declare function fixedSizeSmallArray<T, V = Partial<T>>(lengthBeet: FixedSizeBeet<number>, elements: FixedSizeBeet<T, V>[], elementsByteSize: number): FixedSizeBeet<T[], V[]>;
/**
 * Wraps a small array De/Serializer with configurable length prefix and elements of type {@link T}
 * which do not all have the same size.
 *
 * @template T type of elements held in the array
 *
 * @param lengthBeet the De/Serializer for the array length prefix
 * @param element the De/Serializer for the element types
 *
 * The implementation is minor modification of `array` where the length is encoded as `lengthBeet.byteSize` bytes:
 * https://github.dev/metaplex-foundation/beet/blob/e053b7b5b0c46ce7f6906ecd38be9fd85d6e5254/beet/src/beets/collections.ts#L137
 */
export declare function smallArray<T, V = Partial<T>>(lengthBeet: FixedSizeBeet<number>, element: Beet<T, V>): FixableBeet<T[], V[]>;
export declare type CompiledMsInstruction = {
    programIdIndex: number;
    accountIndexes: number[];
    data: number[];
};
export declare const compiledMsInstructionBeet: beet.FixableBeetArgsStruct<CompiledMsInstruction>;
export declare type MessageAddressTableLookup = {
    /** Address lookup table account key */
    accountKey: PublicKey;
    /** List of indexes used to load writable account addresses */
    writableIndexes: number[];
    /** List of indexes used to load readonly account addresses */
    readonlyIndexes: number[];
};
export declare const messageAddressTableLookupBeet: beet.FixableBeetArgsStruct<MessageAddressTableLookup>;
export declare type TransactionMessage = {
    numSigners: number;
    numWritableSigners: number;
    numWritableNonSigners: number;
    accountKeys: PublicKey[];
    instructions: CompiledMsInstruction[];
    addressTableLookups: MessageAddressTableLookup[];
};
export declare const transactionMessageBeet: beet.FixableBeetArgsStruct<TransactionMessage>;
