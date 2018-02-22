import RtmptMethod from "../consts/RtmptMethod";

let sessionId = null;
let requestId = 0;

const RtmptUrlBuilder = {
    increaseRequestId() {
        requestId++;
    },
    setSessionId(value) {
        sessionId = value;
        requestId = 0;
    },
    getRequestUrl(host, method) {
        let urlSessionId = sessionId ? `${sessionId}/` : "";
        let urlRequestId = method === RtmptMethod.OPEN ? 1 : requestId;
        return `${host}/${method}/${urlSessionId}${urlRequestId}`;
    },
}

export default RtmptUrlBuilder;
