import { WebSocket } from 'uWebSockets.js';
import { SocketUserData } from './index';
import { BufferWriter } from '../../shared/packet/BufferWriter';
import { BufferReader } from '../../shared/packet/BufferReader';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER } from '../../shared/packet/header';
import { EntityFactory, world } from './EntityFactory';
import { EDict } from '../../shared/EDict';
import { C_Camera, C_ClientControls } from './ecs';
import { removeEntity } from 'bitecs';
import { meters } from './utils/conversion';

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

                    removeEntity(world, this.eid);
                    this.eid = EntityFactory.createPlayer();
                    C_Camera.eid[this.eid] = this.eid;

                    // write handshake to spawn client into the game server
                    const writer = this.bufferWriter;

                    writer.writeU8(SERVER_PACKET_HEADER.SET_CAMERA);
                    writer.writeU32(C_Camera.eid[this.eid]);

                    writer.writeU8(SERVER_PACKET_HEADER.SPAWN_SUCCESS);

                    console.log('client joined', nickname);
                    break;
                }
                case CLIENT_PACKET_HEADER.MOUSE: {
                    const angle = reader.readF32();
                    let mag = reader.readF32();
                    if (mag < 1) mag = 0;
                    if (mag > 1) mag = 1;

                    const velX = mag * Math.cos(angle);
                    const velY = mag * Math.sin(angle);

                    C_ClientControls.x[this.eid] = velX;
                    C_ClientControls.y[this.eid] = velY;
                    break;
                }
                case CLIENT_PACKET_HEADER.MOUSE_DOWN: {
                    C_ClientControls.turbo[this.eid] = +true;
                    break;
                }
                case CLIENT_PACKET_HEADER.MOUSE_UP: {
                    C_ClientControls.turbo[this.eid] = +false;
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
