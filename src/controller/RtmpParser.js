import Config from "../config/Config";
import { ByteArray, Endian, ObjectEncoding } from "../utils/ByteArray";
import RtmpMessageType from "../consts/RtmpMessageType";
import RtmpUserControlEvent from "../consts/RtmpUserControlEvent";

let chunkList = [];

const RtmpParser = {

    parse(chunk, offset = 0) {
        let bytes = chunk instanceof ByteArray ? new ByteArray(chunk.bytes) : new ByteArray(chunk);
        bytes.position = offset;
        while (bytes.bytesAvailable) {
            let chunkHeader = this._parseBasicHeader(bytes);
            let chunkData = chunkList[chunkHeader.streamId];
            if (!chunkData) {
                chunkData = {};
                chunkList[chunkHeader.streamId] = chunkData;
            }

            chunkData.chunkHeader = chunkHeader;
            let messageHeader = this._parseMessageHeader(bytes, chunkData);
            chunkData.messageHeader = messageHeader;

            if (messageHeader.timestamp == 0xFFFFFF) {
                messageHeader.timestamp = bytes.readUnsignedInt();
            }

            let messageData = this._readMessageStream(bytes, chunkData);
            chunkData.messageData = messageData;

            let messageIsComplete = messageData.length === messageHeader.length;
            console.log(`messageData.isComplete: ${messageIsComplete}`);
            if (messageIsComplete && messageData.length) {
                console.log(`message completed at ${bytes.position}/${bytes.length}`);
                try {
                    this._parseMessagePayload(chunkData);
                }
                catch (e) {
                    console.log(e);
                    console.log("error on position " + messageData.position);
                }
                delete chunkList[chunkHeader.streamId];
            }
        }
    },

    _parseBasicHeader(bytes) {
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
    },

    _parseMessageHeader(bytes, chunkData) {
        let chunkHeader = chunkData.chunkHeader;
        let messageHeader = chunkData.messageHeader;
        if (!messageHeader) {
            messageHeader = {};
        }

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

        messageHeader.endian = Endian.LITTLE;
        messageHeader.streamId = bytes.readUnsignedInt();
        messageHeader.endian = Endian.BIG;

        return messageHeader;
    },

    _readMessageStream(bytes, chunkData) {
        let messageHeader = chunkData.messageHeader;
        let messageData = chunkData.messageData;
        if (!messageData) {
            messageData = new ByteArray();
        }

        console.log("message type: " + messageHeader.type);
        console.log("message length: " + messageHeader.length + " (" + messageData.length + " bytes read)");
        console.log("message start: " + bytes.position);

        let numBytes = Math.min(
            Config.chunkSize,
            messageHeader.length,
            bytes.bytesAvailable,
            messageHeader.length - messageData.length
        );

        let payload = new ArrayBuffer();
        if (numBytes > 0) {
            messageData.writeBytes(bytes, bytes.position, numBytes);
        }

        bytes.position += numBytes;

        return messageData;
    },

    _parseMessagePayload(chunkData) {
        let messageHeader = chunkData.messageHeader;
        let payload = chunkData.messageData;

        payload.position = 0;
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
                payload.objectEncoding =
                    messageHeader.type == RtmpMessageType.CONTROL_AMF0 || messageHeader.type == RtmpMessageType.METADATA_AMF0 ?
                    ObjectEncoding.AMF0 : ObjectEncoding.AMF3;

                while (payload.bytesAvailable) {
                    console.log(payload.position + "/" + payload.length);
                    let parsed = payload.readObject();
                    console.log(JSON.stringify(parsed));
                }
                break;
            }
        }
    },
}

export default RtmpParser;
