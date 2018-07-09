import { ByteArray } from "../utils/ByteArray";

export interface RtmpChunkHeader {
    type: number;
    streamId: number;
}

export interface RtmpMessageHeader {
    type: number;
    timestamp?: number;
    length?: number;
    streamId?: number;
}

export interface RtmpChunk {
    chunkHeader: RtmpChunkHeader;
    messageHeader: RtmpMessageHeader;
    messageData: ByteArray;
}
