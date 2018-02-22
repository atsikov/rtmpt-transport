import { Buffer } from "buffer";

export class ReadableBuffer {
    private buffer: Uint8Array;
    private position = 0;
    constructor(buffer: Uint8Array) {
        this.buffer = buffer;
    }

    public read(length: number): Uint8Array {
        const bytesToRead = Math.min(length, this.getAvailalbeBytes());
        const chunk =  Buffer.from(this.buffer.buffer, this.position, bytesToRead);
        this.position += bytesToRead;
        return chunk;
    }

    public getPosition() {
        return this.position;
    }

    private getAvailalbeBytes(): number {
        return this.buffer.length - this.position;
    }
}