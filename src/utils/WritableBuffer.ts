export class WritableBuffer {
    private buffer: Uint8Array | undefined;

    public write(chunk: Uint8Array) {
        if (!this.buffer) {
            this.buffer = new Uint8Array(chunk);
        } else {
            const currentBuffer = this.buffer;
            this.buffer = new Uint8Array(currentBuffer.length + chunk.length);
            this.buffer.set(currentBuffer);
            this.buffer.set(chunk, currentBuffer.length);
        }
    }

    public getBuffer() {
        return this.buffer;
    }

    public getLength() {
        return this.buffer && this.buffer.length || 0;
    }
}