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
Object.defineProperty(exports, "__esModule", { value: true });
exports.smallArray = exports.fixedSizeSmallArray = void 0;
const beet_1 = require("@metaplex-foundation/beet");
const assert = __importStar(require("assert"));
/**
 * De/Serializes a small array with a specific number of elements of type {@link T}
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
function fixedSizeSmallArray(lengthBeet, elements, elementsByteSize) {
    const len = elements.length;
    const firstElement = len === 0 ? '<EMPTY>' : elements[0].description;
    return {
        write: function (buf, offset, value) {
            assert.equal(value.length, len, `array length ${value.length} should match len ${len}`);
            lengthBeet.write(buf, offset, len);
            let cursor = offset + lengthBeet.byteSize;
            for (let i = 0; i < len; i++) {
                const element = elements[i];
                element.write(buf, cursor, value[i]);
                cursor += element.byteSize;
            }
        },
        read: function (buf, offset) {
            const size = lengthBeet.read(buf, offset);
            assert.equal(size, len, 'invalid byte size');
            let cursor = offset + lengthBeet.byteSize;
            const arr = new Array(len);
            for (let i = 0; i < len; i++) {
                const element = elements[i];
                arr[i] = element.read(buf, cursor);
                cursor += element.byteSize;
            }
            return arr;
        },
        byteSize: lengthBeet.byteSize + elementsByteSize,
        length: len,
        description: `Array<${firstElement}>(${len})[ ${lengthBeet.byteSize} + ${elementsByteSize} ]`,
    };
}
exports.fixedSizeSmallArray = fixedSizeSmallArray;
/**
 * Wraps a small array De/Serializer with elements of type {@link T}
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
function smallArray(lengthBeet, element) {
    return {
        toFixedFromData(buf, offset) {
            const len = lengthBeet.read(buf, offset);
            const cursorStart = offset + lengthBeet.byteSize;
            let cursor = cursorStart;
            const fixedElements = new Array(len);
            for (let i = 0; i < len; i++) {
                const fixedElement = (0, beet_1.fixBeetFromData)(element, buf, cursor);
                fixedElements[i] = fixedElement;
                cursor += fixedElement.byteSize;
            }
            return fixedSizeSmallArray(lengthBeet, fixedElements, cursor - cursorStart);
        },
        toFixedFromValue(vals) {
            assert.ok(Array.isArray(vals), `${vals} should be an array`);
            let elementsSize = 0;
            const fixedElements = new Array(vals.length);
            for (let i = 0; i < vals.length; i++) {
                const fixedElement = (0, beet_1.fixBeetFromValue)(element, vals[i]);
                fixedElements[i] = fixedElement;
                elementsSize += fixedElement.byteSize;
            }
            return fixedSizeSmallArray(lengthBeet, fixedElements, elementsSize);
        },
        description: `smallArray`,
    };
}
exports.smallArray = smallArray;
