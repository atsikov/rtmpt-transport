import RtmptUrlBuilder from "./RtmptUrlBuilder"
import RtmptMethod from "../consts/RtmptMethod";

class RtmptXhrLoader {

    constructor(
        host,
        method,
        payload = null
    ) {
        this._method = method;

        let req = new XMLHttpRequest();
        req.open("POST", RtmptUrlBuilder.getRequestUrl(host, method));
        req.responseType = "arraybuffer";
        req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");

        this._request = req;
        this._payload = payload;
    }

    send() {
        return new Promise(
            (resolve, reject) => {
                this._request.onload = (evt) => {
                    let response = this._request.response;
                    if (response) {
                        let bytes = new Uint8Array(response);
                        if (this._method === RtmptMethod.OPEN) {
                            let sessionId = bytes.reduce((sid, byte) => {
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
                this._request.onerror = (evt) => {
                    reject(evt);
                }
                this._request.send(this._payload);
            }
        );
    }
}

export default RtmptXhrLoader;
