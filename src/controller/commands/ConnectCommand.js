import { AmfObject } from "../../utils/AmfObject";

class ConnectCommand {
    contructor(host, port, app) {
        this._app = app;

        let protocol;
        switch (port)
        {
            case 80:
                protocol = "rtmpt";
                break;
            case 443:
                protocol = "rtmps";
                break;
            default:
                protocol = "rtmp";
        }

        this._tcUrl = `${protocol}://${host}:${port}/${app}`;
    }

    getPayload()
    {
        // let audioCodecs = 0x0400;
        // let videoCodecs = 0x0080;

        // let result = {
        //     app: this._app,
        //     tcUrl: this._tcUrl,
        //     audioCodecs,
        //     videoCodecs,
        // };

        let result = new AmfObject({
            "app":"casino/im",
            "tcUrl":"rtmps://fra1-wowza-e09.egcdn.video:443/casino/im",
            "fpad":false,
            "capabilities":239,
            "audioCodecs":3575,
            "videoCodecs":252,
            "videoFunction":1,
            "objectEncoding":3
        });

        return result;
    }
}

export default ConnectCommand;
