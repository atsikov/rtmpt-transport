import * as AMF from "../vendor/amfjs/amf-js";
import { WritableBuffer } from "./WritableBuffer";
import { ReadableBuffer } from "./ReadableBuffer";

const Endian = {
    LITTLE: "littleEndian",
    BIG: "bigEndian",
};

const ObjectEncoding = {
    AMF0: "amf0",
    AMF3: "amf3",
};

class ByteArray {

    constructor(buffer = new Uint8Array()) {
        let typedArrayBuffer;
        if (buffer.constructor === ArrayBuffer) {
            typedArrayBuffer = new Uint8Array(buffer);
        } else {
            typedArrayBuffer = new Uint8Array(buffer.buffer);
        }
        this._buffer = buffer;
        this._position = 0;
        this._endian = Endian.BIG;
        this._objectEncoding = ObjectEncoding.AMF0;

        // check if 0x1 is encoded as 0x1 0x0 (le) or 0x0 0x1 (be) for Int16 on current device
        let endianTestBytes = new Uint8Array(new Uint16Array([1]));
        this._typedArrayEndian = endianTestBytes[0] == 1 ? Endian.LITTLE : Endian.BIG;
    }

    _getAMFEncoding() {
        return this._objectEncoding === ObjectEncoding.AMF3 ? AMF.AMF3 : AMF.AMF0;
    }

    _readWithEndian(numBytes) {
        let bytes = this.readBytes(numBytes);
        if (this._endian === Endian.LITTLE) {
            bytes = bytes.reverse();
        }
        return bytes;
    }

    _readAsNumber(numBytes) {
        return this._readWithEndian(numBytes)
            .reverse()
            .reduce((num, byte, index) => num + (byte << index * 8), 0);
    }

    readBytes(numBytes) {
        if (numBytes > this._buffer.byteLength - this.position) {
            throw new Error("Not enough bytes to read");
        }

        let bytes = this._buffer.slice(this.position, this.position + numBytes);
        this.position += numBytes;
        return bytes;
    }

    get position() {
        return this._position;
    }

    set position(value) {
        this._position = Math.min(value, this.length);
    }

    get objectEncoding() {
        return this._objectEncoding;
    }

    set objectEncoding(value) {
        this._objectEncoding = value;
    }

    get length() {
        return this._buffer.byteLength;
    }

    get bytesAvailable() {
        return this._buffer.byteLength - this._position;
    }

    get buffer() {
        return new ArrayBuffer(this._buffer);
    }

    get bytes() {
        return this._buffer;
    }

    readByte() {
        return new Int8Array([this._readAsNumber(1)])[0];
    }

    readUnsignedByte() {
        return new Uint8Array([this._readAsNumber(1)])[0];
    }

    readShort() {
        return new Int16Array([this._readAsNumber(2)])[0];
    }

    readUnsignedShort() {
        return new Uint16Array([this._readAsNumber(2)])[0];
    }

    readInt24() {
        let most = new Int8Array([this._readAsNumber(1)])[0];
        let less = new Uint16Array([this._readAsNumber(2)])[0];
        return most << 16 | less;
    }

    readUnsignedInt24() {
        let most = new Uint8Array([this._readAsNumber(1)])[0];
        let less = new Uint16Array([this._readAsNumber(2)])[0];
        return most << 16 | less;
    }

    readInt() {
        return new Int32Array([this._readAsNumber(4)])[0];
    }

    readUnsignedInt() {
        return new Uint32Array([this._readAsNumber(4)])[0];
    }

    readObject() {
        const availableData = this._buffer.slice(this.position, this._buffer.length);
        const stream = new ReadableBuffer(availableData);
        const decoder = new AMF.AMFDecoder(stream);
        const value = decoder.decode(this._getAMFEncoding());
        this._position += stream.getPosition();
        return value;
    }

    writeBytes(buffer, offset = 0, length = 0) {
        let byteArray;
        let typedArray;
        if (buffer.constructor === ByteArray) {
            byteArray = buffer;
        } else {
            typedArray = new Uint8Array(buffer.buffer);
        }
        let bytesFullSize = byteArray ? byteArray.length : typedArray.byteLength;
        let numBytes = length === 0 ? bytesFullSize : length;
        numBytes = Math.min(numBytes, bytesFullSize - offset);
        let initPosition = this._position;
        this._position = 0;
        let first = this.readBytes(initPosition);

        let last;
        if (initPosition + numBytes < this.length) {
            this._position = initPosition + numBytes;
            last = this.readBytes(this.length - this._position);
        } else {
            last = new Uint8Array();
        }

        let insert;
        if (byteArray) {
            let byteArrayPosition = byteArray.position;
            if (offset < byteArray.length) {
                byteArray.position = offset;
                insert = byteArray.readBytes(Math.min(numBytes, byteArray.bytesAvailable));
            } else {
                insert = new Uint8Array();
            }
            byteArray.position = byteArrayPosition;
        } else {
            insert = typedArray.slice(offset, Math.min(numBytes, typedArray.byteLength - offset));
        }
        this._buffer = new Uint8Array(first.byteLength + insert.byteLength + last.byteLength);
        this._buffer.set(first, 0);
        this._buffer.set(insert, first.byteLength);
        this._buffer.set(last, first.byteLength + insert.byteLength);
        this.position = initPosition + numBytes;
    }

    _writeWithDefaultEndian(bytes) {
        let needReverse = this._typedArrayEndian === Endian.LITTLE;
        this.writeBytes(bytes.reverse());
    }

    writeByte(value) {
        let bytes = new Uint8Array([value]);
        this._writeWithDefaultEndian(bytes);
    }

    writeShort(value) {
        let bytes = new Uint16Array([value]);
        this._writeWithDefaultEndian(bytes);
    }

    writeInt24(value) {
        let bytes = new Uint8Array(
            [
                value >>> 16 & 0xFF,
                value >>> 8 & 0xFF,
                value & 0xFF,
            ]
        );
        this.writeBytes(bytes);
    }

    writeInt(value) {
        let bytes = new Uint32Array([value]);
        this._writeWithDefaultEndian(bytes);
    }

    writeObject(value) {
        const writable = new WritableBuffer();
        const encoder = new AMF.AMFEncoder(writable);
        encoder.encode(value, this._getAMFEncoding());
        this.writeBytes(writable.getBuffer(), 0, writable.getLength());
    }

}

export { ByteArray, Endian, ObjectEncoding };
