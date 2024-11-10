import { WebSocket } from 'uWebSockets.js';
import { SocketUserData } from './index';
import { BufferWriter } from '../../shared/packet/BufferWriter';
import { BufferReader } from '../../shared/packet/BufferReader';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER } from '../../shared/packet/header';
import { EntityFactory } from './EntityFactory';
import { EDict } from '../../shared/EDict';
import { C_Camera } from './ecs';

const reader = new BufferReader();

let _cid = 0;

export class Client {
    static clients = new EDict<number, Client>();
    ws: WebSocket<SocketUserData>;
    eid: number;
    cid: number = _cid++;
    bufferWriter: BufferWriter = new BufferWriter();
    nickname: string = '';
    visibleEids: Set<number> = new Set();
    /**
     * active: is the client inside the game world? Or in the lobby
     */
    active: boolean = false;
    constructor(ws: WebSocket<SocketUserData>) {
        this.ws = ws;
        this.eid = EntityFactory.createSpectator();
        Client.clients.add(this.cid, this);

        const writer = this.bufferWriter;
        writer.writeU8(SERVER_PACKET_HEADER.SET_CAMERA);
        writer.writeU32(C_Camera.eid[this.eid]);
    }

    onSocketMessage(message: ArrayBuffer) {
        reader.loadBuffer(message);

        while (reader.getOffset() < reader.byteLength()) {
            const header = reader.readU8();
            switch (header) {
                case CLIENT_PACKET_HEADER.JOIN_SERVER: {
                    if (this.active) {
                        console.log('client already active');
                        // drop packet
                        return;
                    }

                    // we would want to validate any data before processing it
                    // this would ensure we do not read outside the buffer length
                    const nickname = reader.readString() || 'unnamed';
                    this.nickname = nickname;
                    this.active = true;

                    // write handshake to spawn client into the game server
                    const writer = this.bufferWriter;
                    writer.writeU8(SERVER_PACKET_HEADER.SPAWN_SUCCESS);
                    writer.writeU32(this.eid);

                    console.log('client joined', nickname);
                    break;
                }
            }
        }
    }
    syncBuffer() {
        const buffer = this.bufferWriter.getBuffer();
        this.ws.send(buffer, true);
        this.bufferWriter.clear();
    }
}
