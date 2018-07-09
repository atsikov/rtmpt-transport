import { RtmptUrlBuilder } from "./RtmptUrlBuilder"
import { RtmptMethod } from "../consts";

export class RtmptXhrLoader {
    private method: string;
    private request: XMLHttpRequest;
    private payload: Uint8Array | undefined;

    constructor(host: string, method: RtmptMethod, payload?: Uint8Array) {
        this.method = method;
        this.payload = payload;

        const req = new XMLHttpRequest();
        req.open("POST", RtmptUrlBuilder.getRequestUrl(host, method));
        req.responseType = "arraybuffer";
        req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        this.request = req;
    }

    send() {
        return new Promise<Uint8Array>(
            (resolve, reject) => {
                this.request.onload = (event) => {
                    const response = this.request.response;
                    if (response) {
                        const bytes = new Uint8Array(response);
                        if (this.method === RtmptMethod.OPEN) {
                            const sessionId = bytes.reduce((sid, byte) => {
                                if (byte !== 10 && byte !== 13) {
                                    sid += String.fromCharCode(byte);
                                }
                                return sid;
                            }, "");
                            RtmptUrlBuilder.setSessionId(sessionId);
                        } else {
                            RtmptUrlBuilder.increaseRequestId();
                        }

                        resolve(new Uint8Array(bytes));
                    }
                };
                this.request.onerror = (evt) => {
                    reject(evt);
                }
                this.request.send(this.payload);
            }
        );
    }
}
