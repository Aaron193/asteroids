export const CLIENT_PACKET_HEADER = {
    JOIN_SERVER: 0,
    MOUSE: 1,
    MOUSE_DOWN: 2,
    MOUSE_UP: 3,
    TURBO_START: 4,
    TURBO_END: 5,
};

export const SERVER_PACKET_HEADER = {
    CREATE_ENTITY: 1,
    DESTROY_ENTITY: 2,
    UPDATE_ENTITY: 3,
    SPAWN_SUCCESS: 4,
    SET_CAMERA: 5,
    DIED: 6,
};
