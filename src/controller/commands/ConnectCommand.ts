import { AmfObject } from "../../utils/AmfObject";

export class ConnectCommand {
    private app: string;
    private tcUrl: string;

    constructor(host: string, port: number, app: string) {
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

        this.app = app;
        this.tcUrl = `${protocol}://${host}:${port}/${app}`;
    }

    public getPayload(): AmfObject
    {
        const audioCodecs = 0x0400;
        const videoCodecs = 0x0080;

        let result = new AmfObject({
            app: this.app,
            tcUrl: this.tcUrl,
            audioCodecs,
            videoCodecs,
            objectEncoding: 0,
        });

        // result = new AmfObject({
        //     "app":"casino/im",
        //     "tcUrl":"rtmps://fra1-wowza-e09.egcdn.video:443/casino/im",
        //     "fpad":false,
        //     "capabilities":239,
        //     "audioCodecs":3575,
        //     "videoCodecs":252,
        //     "videoFunction":1,
        //     "objectEncoding":3
        // });

        return result;
    }
}
