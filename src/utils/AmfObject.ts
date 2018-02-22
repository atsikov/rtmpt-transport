import * as AMF from "../vendor/amfjs/amf-js";

export class AmfObject extends AMF.Serializable {
    constructor(data: object) {
        super("amf_object");
        this.writeKeys(data);
    }

    private writeKeys(data: object, dest: any = this) {
        const keys = Object.keys(data);
        keys.forEach(key => {
            const value = data[key];
            if (this.isIterable(typeof value)) {
                this.writeKeys(value, dest[key]);
            } else {
                dest[key] = value;
            }
        });
    }
    private isIterable(valueType: string): boolean {
        return !(
            valueType === "string" ||
            valueType === "number" ||
            valueType === "boolean" ||
            valueType === "function"
        );
    }
}
