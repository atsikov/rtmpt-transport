import { ByteArray, Endian, AmfVersion } from "../utils/ByteArray";
import { RtmpMessageType } from "../consts";
import { Config } from "../config/Config";
import { AmfObject } from "../utils/AmfObject";

const CONTROL_CHUNK_STREAM_ID = 2;
let _chunkId = 3;
let _lastChunkTimestamp = 0;

const getChunkHeaderBytes = (chunkType: number) => {
    const chunkHeader = new ByteArray();
    chunkHeader.setEndian(Endian.BIG);
    chunkHeader.setObjectEncoding(AmfVersion.AMF0);

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
};

export const createRtmpChunk = (command: string, ...payload: (string | number | boolean | AmfObject | any[] | undefined | null)[]) => {
    let chunk = new ByteArray();
    chunk.setEndian(Endian.BIG);
    chunk.setObjectEncoding(AmfVersion.AMF0);

    let payloadBytes = new ByteArray();
    chunk.setEndian(Endian.BIG);
    chunk.setObjectEncoding(AmfVersion.AMF0);
    payloadBytes.writeObject(command);
    payloadBytes.writeObject(1);
    payload.forEach(data => payloadBytes.writeObject(data));
    payloadBytes.setPosition(0);

    while (payloadBytes.getBytesAvailable())
    {
        let chunkType = payloadBytes.getPosition() === 0 ? 0 : 3;

        chunk.writeBytes(getChunkHeaderBytes(chunkType));

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
            let payloadLength = payloadBytes.getLength();
            chunk.writeInt24(payloadLength);
            chunk.writeByte(RtmpMessageType.CONTROL_AMF0);
        }

        if (chunkType < 1)
        {
            chunk.writeInt(0);
        }

        let numBytes = Math.min(payloadBytes.getBytesAvailable(), Config.chunkSize);
        chunk.writeBytes(payloadBytes, payloadBytes.getPosition(), numBytes);

        payloadBytes.setPosition(payloadBytes.getPosition() + numBytes);
    }

    return chunk;
};
