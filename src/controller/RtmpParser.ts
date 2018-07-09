import { Config } from "../config/Config";
import { ByteArray, Endian, AmfVersion } from "../utils/ByteArray";
import {
    RtmpMessageType,
    RtmpUserControlEvent
} from "../consts";
import { RtmpChunkHeader, RtmpChunk, RtmpMessageHeader } from "../interface/Rtmp";

let chunkList: { [key: number]: RtmpChunk } = {};

const parseBasicHeader = (bytes: ByteArray): RtmpChunkHeader => {
    let firstByte = bytes.readUnsignedByte();
    let type = firstByte >> 6;
    let streamId = firstByte & 0x3F;
    let headerSize;
    switch (streamId) {
        case 0: {
            let secondByte = bytes.readUnsignedByte();
            streamId = secondByte + 64;
            headerSize = 2;
            break;
        }
        case 1: {
            let secondByte = bytes.readUnsignedByte();
            let thirdByte = bytes.readUnsignedByte();
            streamId = thirdByte * 256 + secondByte + 64;
            headerSize = 3;
            break;
        }
        default: {
            headerSize = 1;
        }
    }

    let chunkHeader = {
        type,
        streamId
    };
    return chunkHeader;
};

const parseMessageHeader = (bytes: ByteArray, chunkData: RtmpChunk): RtmpMessageHeader => {
    const chunkHeader = chunkData.chunkHeader;
    const messageHeader = chunkData.messageHeader || {};

    if (chunkHeader.type == 3) {
        return messageHeader;
    }

    messageHeader.timestamp = bytes.readUnsignedInt24();

    if (chunkHeader.type == 2) {
        return messageHeader;
    }

    messageHeader.length = bytes.readUnsignedInt24();
    messageHeader.type = bytes.readUnsignedByte();

    if (chunkHeader.type == 1) {
        return messageHeader;
    }

    bytes.setEndian(Endian.LITTLE);
    messageHeader.streamId = bytes.readUnsignedInt();
    bytes.setEndian(Endian.BIG);

    return messageHeader;
};

const readMessageStream = (bytes: ByteArray, chunkData: RtmpChunk) => {
    const messageHeader = chunkData.messageHeader;
    const messageData = chunkData.messageData || new ByteArray();

    console.log("message type: " + messageHeader.type);
    console.log("message length: " + messageHeader.length + " (" + messageData.getLength() + " bytes read)");
    console.log("message start: " + bytes.getPosition());

    const numBytes = Math.min(
        Config.chunkSize,
        messageHeader.length || 0,
        bytes.getBytesAvailable(),
        messageHeader.length || 0 - messageData.getLength()
    );

    if (numBytes > 0) {
        messageData.writeBytes(bytes, bytes.getPosition(), numBytes);
    }

    bytes.setPosition(bytes.getPosition() + numBytes);

    return messageData;
};

const detectAmfVersion = (messageType: number): AmfVersion =>
    messageType == RtmpMessageType.CONTROL_AMF3 || messageType == RtmpMessageType.METADATA_AMF3
        ? AmfVersion.AMF3
        : AmfVersion.AMF0;

const parseMessagePayload = (chunkData: RtmpChunk) => {
    const messageHeader = chunkData.messageHeader;
    const payload = chunkData.messageData;
    payload.setPosition(0);

    switch (messageHeader.type) {
        case RtmpMessageType.CONTROL_CHUNK_SIZE: {
            Config.chunkSize = payload.readUnsignedInt();
            console.log(`new chunk size: ${Config.chunkSize}`);
            break;
        }
        case RtmpMessageType.CONTROL_USER_CONTROL: {
            let eventType = payload.readUnsignedShort();
            console.log("user control event: " + eventType);
            switch (eventType) {
                case RtmpUserControlEvent.SET_BUFFER_LENGTH: {
                    let streamId = payload.readUnsignedInt();
                    let bufferLength = payload.readUnsignedInt();
                    console.log("set " + bufferLength + " buffer for stream " + streamId);
                    break;
                }
                case RtmpUserControlEvent.PING_REQUEST:
                case RtmpUserControlEvent.PING_RESPONSE: {
                    let timestamp = payload.readUnsignedInt();
                    console.log(timestamp);
                    break;
                }
            }
            break;
        }
        case RtmpMessageType.MEDIA_AUDIO:
            break;
        case RtmpMessageType.MEDIA_VIDEO:
            break;
        case RtmpMessageType.CONTROL_ACKNOLEDGEMENT: {
            console.log("acknoledgement sequence number: " + payload.readUnsignedInt());
            break;
        }
        case RtmpMessageType.CONTROL_WINDOW_ACKNOLEDGEMENT_SIZE: {
            console.log("acknoledgement window size: " + payload.readUnsignedInt());
            break;
        }
        case RtmpMessageType.METADATA_AMF0:
        case RtmpMessageType.METADATA_AMF3:
        case RtmpMessageType.CONTROL_AMF0:
        case RtmpMessageType.CONTROL_AMF3: {
            // payload.setObjectEncoding(detectAmfVersion(messageHeader.type));

            // FMS (at least Wowza implementation) encodes AMF3 as AMF0 prefixed with 0
            // This workaround allows to read such contents but safer to send 0 as objectEncoding on connect
            payload.setObjectEncoding(AmfVersion.AMF0);
            if (detectAmfVersion(messageHeader.type) === AmfVersion.AMF3) {
                payload.readByte();
            }

            while (payload.getBytesAvailable()) {
                console.log(payload.getPosition() + "/" + payload.getLength());
                let parsed = payload.readObject();
                console.log(JSON.stringify(parsed));
            }
            break;
        }
    }
};

export const parseRtmpChunk = (chunk: ByteArray | Uint8Array | ArrayBuffer, offset = 0) => {
    let bytes = chunk instanceof ByteArray ? new ByteArray(chunk.getBytes()) : new ByteArray(chunk);
    bytes.setPosition(offset);
    while (bytes.getBytesAvailable()) {
        const basicHeader = parseBasicHeader(bytes);
        const chunkData = chunkList[basicHeader.streamId] || {};
        chunkList[basicHeader.streamId] = chunkData;

        chunkData.chunkHeader = basicHeader;

        const messageHeader = parseMessageHeader(bytes, chunkData);
        chunkData.messageHeader = messageHeader;

        if (messageHeader.timestamp == 0xFFFFFF) {
            messageHeader.timestamp = bytes.readUnsignedInt();
        }

        const messageData = readMessageStream(bytes, chunkData);
        chunkData.messageData = messageData;

        let messageIsComplete = messageData.getLength() === messageHeader.length;
        console.log(`messageData.isComplete: ${messageIsComplete}`);
        if (messageIsComplete && messageData.getLength()) {
            console.log(`message completed at ${bytes.getPosition()}/${bytes.getLength()}`);
            try {
               parseMessagePayload(chunkData);
            }
            catch (e) {
                console.log(e);
                console.log("error on position " + messageData.getPosition());
            }
            delete chunkList[basicHeader.streamId];
        }
    }
};
