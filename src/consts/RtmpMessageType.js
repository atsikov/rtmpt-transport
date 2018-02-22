const RtmpMessageType = {
    UNKNOWN: 0,
    CONTROL_CHUNK_SIZE: 1,
    CONTROL_ABORT: 2,
    CONTROL_ACKNOLEDGEMENT: 3,
    CONTROL_USER_CONTROL: 4,
    CONTROL_WINDOW_ACKNOLEDGEMENT_SIZE: 5,
    CONTROL_BANDWIDTH: 6,
    MEDIA_AUDIO: 8,
    MEDIA_VIDEO: 9,
    METADATA_AMF3: 15,
    CONTROL_AMF3: 17,
    METADATA_AMF0: 18,
    CONTROL_AMF0: 20,
    AGGREGATE: 22,
};

export default RtmpMessageType