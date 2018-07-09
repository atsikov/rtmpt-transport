import { RtmptMethod } from "../consts";

let sessionId: string | undefined;
let requestId = 0;

export const RtmptUrlBuilder = {
    increaseRequestId() {
        requestId++;
    },
    setSessionId(value: string) {
        sessionId = value;
        requestId = 0;
    },
    getRequestUrl(host: string, method: RtmptMethod) {
        let urlSessionId = sessionId ? `${sessionId}/` : "";
        let urlRequestId = method === RtmptMethod.OPEN ? 1 : requestId;
        return `${host}/${method}/${urlSessionId}${urlRequestId}`;
    },
}
