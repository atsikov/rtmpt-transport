import { RtmptXhrLoader } from "./loader/RtmptXhrLoader";
import { ByteArray, Endian } from "./utils/ByteArray";
import { createRtmpChunk } from "./controller/ChunkComposer";
import { ConnectCommand } from "./controller/commands/ConnectCommand";
import { RtmptMethod } from "./consts";
import { parseRtmpChunk } from "./controller/RtmpParser";

let sessionId = "";

// const xhr = new XMLHttpRequest();
// xhr.responseType = "arraybuffer";
// xhr.onload = event => {
//     console.log(new Uint8Array(xhr.response));
//     parseRtmpChunk(xhr.response.slice(0));
// };
// xhr.open("GET", "../3.rtmp");
// xhr.send();

// setTimeout(() => {
//     const xhr = new XMLHttpRequest();
//     xhr.responseType = "arraybuffer";
//     xhr.onload = event => {
//         console.log(new Uint8Array(xhr.response));
//         parseRtmpChunk(xhr.response.slice(0));
//     };
//     xhr.open("GET", "../4.rtmp");
//     xhr.send();
// }, 1000);

// throw("stop");

const host = "https://fra1-wowza-e10.egcdn.video";
// const host = "http://localhost:8008";
const nullBytePayload = new Uint8Array([0]);

new RtmptXhrLoader(
    host,
    RtmptMethod.OPEN,
    nullBytePayload
).send()
    .then(() => makeSessionCheckRequest())
    .then((data: Uint8Array) => validateSessionCheckResponse(data))
    .then(() => makeAckRequest())
    .then(() => makeHandshakeRequest())
    .then((data: Uint8Array) => onHandshakeComplete(data))
    .then(() => createStream())
    .then((data: Uint8Array) => onStreamCreated(data))
    .then(() => startPlayback())
    .then((data: Uint8Array) => onPlaybackStarted(data));

function makeSessionCheckRequest() {
    return new RtmptXhrLoader(host, RtmptMethod.IDLE, nullBytePayload).send();
}

function validateSessionCheckResponse(data: Uint8Array) {
    if (data.length > 1) {
        console.log("Wrong session check response");
        console.log(data);
        throw new Error("Rtmpt sesion check failed");
    } else {
        console.log("Session check passed");
    }
}

function makeAckRequest() {
    let now = Math.floor(Date.now() / 1000);
    let payload = new ByteArray();
    // [3, now >> 24, now >> 16 & 0xFF, now >> 8 & 0xFF, now & 0xFF, 0, 0, 0, 22];
    payload.writeByte(3);
    payload.writeInt(now);
    payload.writeInt(22);

    let randomBytes = new Uint8Array(1528);
    for (let i = 0; i < 1528; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256);
    }
    payload.writeBytes(randomBytes);
    console.log(payload.getLength());
    return new RtmptXhrLoader(host, RtmptMethod.SEND, payload.getBytes()).send();
}

function onAckComplete(data:Uint8Array) {
    makeHandshakeRequest();
}

function makeHandshakeRequest() {
    let challenge = new Uint8Array(1536);
    for (let i = 0; i < 1536; i++) {
        challenge[i] = Math.floor(Math.random() * 256);
    }
    let payload = new ByteArray();
    payload.writeBytes(challenge);

    let connectChunk = createRtmpChunk(
        "connect",
        new ConnectCommand(
            "fra1-wowza-e10.egcdn.video",
            443,
            "casino/im"
        ).getPayload()
    );
    connectChunk.setPosition(0);
    console.log(connectChunk.getBuffer());
    console.log("=== connect chunk ===");
    parseRtmpChunk(connectChunk);
    console.log("=== end of connect chunk ===");
    payload.writeBytes(connectChunk);

    return new RtmptXhrLoader(
        host, RtmptMethod.SEND, payload.getBytes()
    ).send();
}

function onHandshakeComplete(data: Uint8Array) {
    console.log(`handshake response length: ${data.length}`);
    console.log(data);
    parseRtmpChunk(new ByteArray(data.slice(1)));
};

function createStream() {
    let createStreamChunk = createRtmpChunk(
        "createStream",
        null,
    );

    return new RtmptXhrLoader(
        host, RtmptMethod.SEND, createStreamChunk.getBytes()
    ).send();
}

function onStreamCreated(data: Uint8Array) {
    console.log(`createStream response length: ${data.length}`);
    console.log(data);
    parseRtmpChunk(new ByteArray(data.slice(1)));
}

function startPlayback() {
    let playChunk = createRtmpChunk(
        "play",
        null,
        "immersive_med",
        -1000,
        -1000,
        true
    );
    parseRtmpChunk(playChunk);
    return new RtmptXhrLoader(
        host, RtmptMethod.SEND, playChunk.getBytes()
    ).send();
}

function onPlaybackStarted(data: Uint8Array) {
    console.log(`play response length: ${data.length}`);
    console.log(data);
    parseRtmpChunk(new ByteArray(data.slice(1)));

    setTimeout(() => new RtmptXhrLoader(
        host, RtmptMethod.IDLE, nullBytePayload
    ).send().then(videoData => parseRtmpChunk(new ByteArray(videoData.slice(1)))), 1000);

    setTimeout(() => new RtmptXhrLoader(
        host, RtmptMethod.IDLE, nullBytePayload
    ).send().then(videoData => parseRtmpChunk(new ByteArray(videoData.slice(1)))), 2000);
}
