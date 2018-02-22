import RtmptXhrLoader from "./loader/RtmptXhrLoader";
import { ByteArray, Endian } from "./utils/ByteArray";
import ChunkComposer from "./controller/ChunkComposer";
import ConnectCommand from "./controller/commands/ConnectCommand";
import RtmptMethod from "./consts/RtmptMethod";
import RtmpParser from "./controller/RtmpParser";

window.ByteArray = ByteArray;

const request = new XMLHttpRequest();
request.responseType = "arraybuffer";
request.onload = event => {
    console.log(new Uint8Array(request.response).slice(1536));
    // RtmpParser.parse(
    //     new ByteArray(
    //         new Uint8Array(request.response).slice(1536)
    //     )
    // );
}
request.open("GET", "../refs/1.rtmp");
request.send();

let sessionId = "";

const host = "https://fra1-wowza-e10.egcdn.video";
// const host = "http://localhost:8008";
const nullBytePayload = new Uint8Array([0]);

const onSessionIdReady = (data) => {
    makeSessionCheckRequest();
}

const makeSessionCheckRequest = () => {
    new RtmptXhrLoader(host, "idle", nullBytePayload).send().then(onSessionCheckComplete);
}

const onSessionCheckComplete = (data) => {
    if (data.length == 1) {
        console.log("Session check passed");
        makeAckRequest();
    }
    else {
        console.log("Wrong session check response");
        console.log(data);
    }
}

const makeAckRequest = () => {
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
    console.log(payload.length);
    new RtmptXhrLoader(host, "send", payload.bytes).send().then(onAckComplete);
}

const onAckComplete = (data) => {
    makeHandshakeRequest();
}

const makeHandshakeRequest = () => {
    let challenge = new Uint8Array(1536);
    for (let i = 0; i < 1536; i++) {
        challenge[i] = Math.floor(Math.random() * 256);
    }
    let payload = new ByteArray();
    payload.writeBytes(challenge);

    let connectChunk = ChunkComposer.buildChunk(
        "connect",
        new ConnectCommand(
            "fra1-wowza-e10.egcdn.video",
            443,
            "casino/im"
        ).getPayload()
    );
    connectChunk.position = 0;
    console.log(connectChunk._buffer);
    console.log("=== connect chunk ===");
    RtmpParser.parse(connectChunk);
    console.log("=== end of connect chunk ===");
    payload.writeBytes(connectChunk);

    new RtmptXhrLoader(
        host, "send", payload.bytes
    ).send().then(onHandshakeComplete);
}

const onHandshakeComplete = (data) => {
    console.log(`handshake response length: ${data.length}`);
    console.log(data);
    RtmpParser.parse(new ByteArray(data.slice(1)));
};

new RtmptXhrLoader(host, "open", nullBytePayload).send().then(onSessionIdReady);
