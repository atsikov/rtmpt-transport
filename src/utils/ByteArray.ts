import * as AMF from "../vendor/amfjs/amf-js";
import { WritableBuffer } from "./WritableBuffer";
import { ReadableBuffer } from "./ReadableBuffer";
import { AmfObject } from "./AmfObject";

enum Endian {
    LITTLE = "littleEndian",
    BIG = "bigEndian",
};

enum AmfVersion {
    AMF0 = "amf0",
    AMF3 = "amf3",
};

class ByteArray {
    private arrayBytes: Uint8Array;
    private position = 0;
    private endian = Endian.BIG;
    private systemEndian: Endian;
    private objectEncoding = AmfVersion.AMF0;

    constructor(buffer: ArrayBuffer | Uint8Array = new Uint8Array(0)) {
        if (buffer instanceof ArrayBuffer) {
            this.arrayBytes = new Uint8Array(buffer);
        } else {
            this.arrayBytes = new Uint8Array(buffer.buffer);
        }
        this.position = 0;

        // check if 0x1 is encoded as 0x1 0x0 (le) or 0x0 0x1 (be) for Int16 on current device
        let endianTestBytes = new Uint8Array(new Uint16Array([1]));
        this.systemEndian = endianTestBytes[0] == 1 ? Endian.LITTLE : Endian.BIG;
    }

    public getEndian(): Endian {
        return this.endian;
    }

    public setEndian(endian: Endian) {
        this.endian = endian;
    }

    public getPosition() {
        return this.position;
    }

    public setPosition(value: number) {
        this.position = Math.min(value, this.getLength());
    }

    public getObjectEncoding() {
        return this.objectEncoding;
    }

    public setObjectEncoding(value: AmfVersion) {
        this.objectEncoding = value;
    }

    public getLength() {
        return this.arrayBytes.byteLength;
    }

    public getBytesAvailable() {
        return this.arrayBytes.byteLength - this.position;
    }

    public getBuffer() {
        return this.arrayBytes.buffer;
    }

    public getBytes() {
        return this.arrayBytes;
    }

    public readBytes(numBytes: number): Uint8Array {
        if (numBytes > this.arrayBytes.byteLength - this.position) {
            throw new Error("Not enough bytes to read");
        }

        let bytes = this.arrayBytes.slice(this.position, this.position + numBytes);
        this.position += numBytes;
        return bytes;
    }

    public readByte() {
        return new Int8Array([this.readAsNumber(1)])[0];
    }

    public readUnsignedByte() {
        return new Uint8Array([this.readAsNumber(1)])[0];
    }

    public readShort() {
        return new Int16Array([this.readAsNumber(2)])[0];
    }

    public readUnsignedShort() {
        return new Uint16Array([this.readAsNumber(2)])[0];
    }

    public readInt24() {
        let most = new Int8Array([this.readAsNumber(1)])[0];
        let less = new Uint16Array([this.readAsNumber(2)])[0];
        return most << 16 | less;
    }

    public readUnsignedInt24() {
        let most = new Uint8Array([this.readAsNumber(1)])[0];
        let less = new Uint16Array([this.readAsNumber(2)])[0];
        return most << 16 | less;
    }

    public readInt() {
        return new Int32Array([this.readAsNumber(4)])[0];
    }

    public readUnsignedInt() {
        return new Uint32Array([this.readAsNumber(4)])[0];
    }

    public readObject() {
        const availableData = this.arrayBytes.slice(this.position, this.arrayBytes.length);
        const stream = new ReadableBuffer(availableData);
        const decoder = new AMF.AMFDecoder(stream);
        const value = decoder.decode(this.getAMFEncoding());
        this.position += stream.getPosition();
        return value;
    }

    public writeBytes(buffer: ByteArray | Uint8Array | Uint16Array | Uint32Array, offset = 0, length = 0) {
        let byteArray: ByteArray | undefined;
        let typedArray: Uint8Array | undefined;
        if (buffer instanceof ByteArray) {
            byteArray = buffer;
        } else {
            typedArray = new Uint8Array(buffer.buffer);
        }
        const bytesFullSize = byteArray ? byteArray.getLength() : typedArray && typedArray.byteLength || 0;
        let numBytes = length === 0 ? bytesFullSize : length;
        numBytes = Math.min(numBytes, bytesFullSize - offset);

        const initPosition = this.position;
        this.position = 0;

        const first = this.readBytes(initPosition);

        const currentLength = this.getLength();
        let last: Uint8Array;
        if (initPosition + numBytes < currentLength) {
            this.position = initPosition + numBytes;
            last = this.readBytes(currentLength - this.position);
        } else {
            last = new Uint8Array(0);
        }

        let insert;
        if (byteArray) {
            let byteArrayPosition = byteArray.position;
            if (offset < byteArray.getLength()) {
                byteArray.position = offset;
                insert = byteArray.readBytes(Math.min(numBytes, byteArray.getBytesAvailable()));
            } else {
                insert = new Uint8Array(0);
            }
            byteArray.position = byteArrayPosition;
        } else if (typedArray) {
            insert = typedArray.slice(offset, Math.min(numBytes, typedArray.byteLength - offset));
        }
        if (insert) {
            this.arrayBytes = new Uint8Array(first.byteLength + insert.byteLength + last.byteLength);
            this.arrayBytes.set(first, 0);
            this.arrayBytes.set(insert, first.byteLength);
            this.arrayBytes.set(last, first.byteLength + insert.byteLength);
            this.position = initPosition + numBytes;
        }
    }

    public writeByte(value: number) {
        let bytes = new Uint8Array([value]);
        this.writeWithDefaultEndian(bytes);
    }

    public writeShort(value: number) {
        let bytes = new Uint16Array([value]);
        this.writeBytes(bytes);
    }

    public writeInt24(value: number) {
        let bytes = new Uint8Array(
            [
                value >>> 16 & 0xFF,
                value >>> 8 & 0xFF,
                value & 0xFF,
            ]
        );
        this.writeBytes(bytes);
    }

    public writeInt(value: number) {
        let bytes = new Uint32Array([value]);
        this.writeWithDefaultEndian(bytes);
    }

    public writeObject(value: string | number | boolean | AmfObject | any[] | undefined | null) {
        const writable = new WritableBuffer();
        const encoder = new AMF.AMFEncoder(writable);
        encoder.encode(value, this.getAMFEncoding());
        
        const encodedBytes = writable.getBuffer();
        if (encodedBytes) {
            this.writeBytes(encodedBytes, 0, writable.getLength());
        } else {
            throw new Error("Unable to encode and write AMF object");
        }
    }

    private getAMFEncoding(): typeof AMF.AMF0 | typeof AMF.AMF3 {
        return this.objectEncoding === AmfVersion.AMF3 ? AMF.AMF3 : AMF.AMF0;
    }

    private readWithEndian(numBytes: number): Uint8Array {
        let bytes = this.readBytes(numBytes);
        if (this.endian === Endian.LITTLE) {
            bytes = bytes.reverse();
        }
        return bytes;
    }

    private readAsNumber(numBytes: number): number {
        return this.readWithEndian(numBytes)
            .reverse()
            .reduce((num, byte, index) => num + (byte << index * 8), 0);
    }

    private writeWithDefaultEndian(bytes: Uint8Array | Uint16Array | Uint32Array) {
        const needReverse = this.systemEndian === Endian.LITTLE;
        this.writeBytes(needReverse ? bytes.reverse() : bytes);
    }

}

export { ByteArray, Endian, AmfVersion };
