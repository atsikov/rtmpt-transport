import { ByteArray, Endian, ObjectEncoding } from "../utils/ByteArray";
import RtmpMessageType from "../consts/RtmpMessageType";
import Config from "../config/Config";

const CONTROL_CHUNK_STREAM_ID = 2;
let _chunkId = 3;
let _lastChunkTimestamp = 0;

const ChunkComposer = {
    buildChunk(command, payload) {
        let chunk = new ByteArray();
        chunk.endian = Endian.BIG_ENDIAN;
        chunk.objectEncoding = ObjectEncoding.AMF0;

        let payloadBytes = new ByteArray();
        payloadBytes.endian = Endian.BIG_ENDIAN;
        payloadBytes.objectEncoding = ObjectEncoding.AMF0;
        payloadBytes.writeObject(command);
        payloadBytes.writeObject(1);
        payloadBytes.writeObject(payload);
        payloadBytes.position = 0;

        while (payloadBytes.bytesAvailable)
        {
            let chunkType = payloadBytes.position == 0 ? 0 : 3;

            chunk.writeBytes(this.getChunkHeaderBytes(chunkType));

            if (chunkType < 3)
            {
                // timestamp delta
                let timestamp = Math.floor(Date.now() / 1000);
                if (_lastChunkTimestamp == 0)
                {
                    _lastChunkTimestamp = timestamp;
                }
                let timestampDelta = timestamp - _lastChunkTimestamp;
                if (timestampDelta > 0xFFFFFF)
                {
                    chunk.writeInt24(0xFFFFFF);
                }
                else
                {
                    chunk.writeInt24(timestampDelta);
                }
            }

            if (chunkType < 2)
            {
                let payloadLength = payloadBytes.length;
                chunk.writeInt24(payloadLength);
                chunk.writeByte(RtmpMessageType.CONTROL_AMF0);
            }

            if (chunkType < 1)
            {
                chunk.writeInt(0);
            }

            let numBytes = Math.min(payloadBytes.bytesAvailable, Config.chunkSize);
            chunk.writeBytes(payloadBytes, payloadBytes.position, numBytes);

            payloadBytes.position += numBytes;
        }

        return chunk;
    },

    getChunkHeaderBytes(chunkType) {
        let chunkHeader = new ByteArray();
        chunkHeader.endian = Endian.BIG_ENDIAN;
        chunkHeader.objectEncoding = ObjectEncoding.AMF0;

        if (_chunkId < 64)
        {
            chunkHeader.writeByte((chunkType << 6) + _chunkId);
        }
        else
        {
            let chunkHeaderFirstByte = chunkType << 6;
            if (_chunkId >= 320)
            {
                chunkHeaderFirstByte += 1;
            }
            chunkHeader.writeByte(chunkHeaderFirstByte);

            if (_chunkId < 320)
            {
                chunkHeader.writeByte(_chunkId - 64);
            }
            else
            {
                chunkHeader.writeShort(_chunkId - 64);
            }
        }

        return chunkHeader;
    },
}

export default ChunkComposer;
