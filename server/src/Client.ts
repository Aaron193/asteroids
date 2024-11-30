import { WebSocket } from 'uWebSockets.js';
import { SocketUserData } from './index';
import { BufferWriter } from '../../shared/packet/BufferWriter';
import { BufferReader } from '../../shared/packet/BufferReader';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER } from '../../shared/packet/header';
import { EntityFactory, world } from './EntityFactory';
import { EDict } from '../../shared/EDict';
import { C_Camera, C_Cid, C_ClientControls } from './ecs';
import { addComponent, removeEntity } from 'bitecs';
import { meters } from './utils/conversion';

const reader = new BufferReader();

let _cid = 0;

export class Client {
    static clients = new EDict<Client>('cid');
    ws: WebSocket<SocketUserData>;
    eid!: number;
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
        Client.clients.add(this);
        this.changeBody(EntityFactory.createSpectator());
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

                    this.changeBody(EntityFactory.createPlayer());

                    const writer = this.bufferWriter;

                    // write handshake to spawn client into the game server
                    writer.writeU8(SERVER_PACKET_HEADER.SPAWN_SUCCESS);
                    writer.writeU32(this.eid);

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
                    C_ClientControls.rotation[this.eid] = angle;
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

    onDied(killerEid: number) {
        EntityFactory.removeEntity(this.eid);
        this.changeBody(EntityFactory.createSpectator(killerEid));

        const writer = this.bufferWriter;
        writer.writeU8(SERVER_PACKET_HEADER.DIED);

        this.active = false;
    }

    changeBody(eid: number) {
        this.eid = eid;
        addComponent(world, C_Cid, this.eid);
        C_Cid.cid[this.eid] = this.cid;

        const writer = this.bufferWriter;
        writer.writeU8(SERVER_PACKET_HEADER.SET_CAMERA);
        writer.writeU32(C_Camera.eid[this.eid]);
    }

    syncBuffer() {
        const buffer = this.bufferWriter.getBuffer();
        this.ws.send(buffer, true);
        this.bufferWriter.clear();
    }
}
