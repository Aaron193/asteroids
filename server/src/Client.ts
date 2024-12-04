import { WebSocket } from 'uWebSockets.js';
import { SocketUserData } from './index';
import { BufferWriter } from '../../shared/packet/BufferWriter';
import { BufferReader } from '../../shared/packet/BufferReader';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER } from '../../shared/packet/header';
import { bodyMap, EntityFactory, world } from './EntityFactory';
import { EDict } from '../../shared/EDict';
import { C_Camera, C_Cid, C_ClientControls, C_Networked, C_Type } from './ecs';
import { addComponent, entityExists, hasComponent, removeEntity } from 'bitecs';
import { b2AABB, b2Fixture } from '@box2d/core';
import { GameWorld } from './World';
import { meters, pixels } from './utils/conversion';

const reader = new BufferReader();
const _tmpAABB_ = new b2AABB();
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
                    C_ClientControls.shooting[this.eid] = +true;
                    break;
                }
                case CLIENT_PACKET_HEADER.MOUSE_UP: {
                    C_ClientControls.shooting[this.eid] = +false;
                    break;
                }
                case CLIENT_PACKET_HEADER.TURBO_START: {
                    C_ClientControls.turbo[this.eid] = +true;
                    break;
                }
                case CLIENT_PACKET_HEADER.TURBO_END: {
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

    /**
     * If we follow an entity that gets destroyed, we need to lock onto another target
     */
    static refreshCameras() {
        const clients = Client.clients.array();

        for (let i = 0; i < clients.length; i++) {
            const client = clients[i];

            const camEid = C_Camera.eid[client.eid];

            if (!entityExists(world, camEid)) {
                client.changeBody(EntityFactory.createSpectator());
            }
        }
    }

    /**
     * Sync all clients with the current state of the game world
     */
    static syncClients() {
        const physicsWorld = GameWorld.instance.world;
        const clients = Client.clients.array();

        for (let i = 0; i < clients.length; i++) {
            const client = clients[i];
            const eid = client.eid;
            const camEid = C_Camera.eid[eid];

            const pos = bodyMap.get(camEid)!.GetPosition();
            const positionX = pos.x;
            const positionY = pos.y;

            // small buffer around view
            const viewX = meters(1920 + 200);
            const viewY = meters(1080 + 200);

            _tmpAABB_.lowerBound.Set(positionX - viewX * 0.5, positionY - viewY * 0.5);
            _tmpAABB_.upperBound.Set(positionX + viewX * 0.5, positionY + viewY * 0.5);

            const oldVisible = client.visibleEids;
            const newVisible = new Set<number>();
            const writer = client.bufferWriter;

            physicsWorld.QueryAABB(_tmpAABB_, (fixture: b2Fixture) => {
                const body = fixture.GetBody();
                const eid = (body.GetUserData() as { eid: number }).eid;
                if (hasComponent(world, C_Networked, eid)) {
                    newVisible.add(eid);
                }
                return true;
            });

            // NV - OV => create
            for (const eid of newVisible) {
                if (!oldVisible.has(eid)) {
                    const pos = bodyMap.get(eid)!.GetPosition();
                    const rot = bodyMap.get(eid)!.GetAngle();
                    writer.writeU8(SERVER_PACKET_HEADER.CREATE_ENTITY);
                    writer.writeU32(eid);
                    writer.writeU8(C_Type.type[eid]);
                    writer.writeF32(pixels(pos.x));
                    writer.writeF32(pixels(pos.y));
                    writer.writeF32(rot);
                }
            }

            // OV - NV => destroy
            for (const eid of oldVisible) {
                if (!newVisible.has(eid)) {
                    writer.writeU8(SERVER_PACKET_HEADER.DESTROY_ENTITY);
                    writer.writeU32(eid);
                }
            }

            // NV ∩ OV => update
            for (const eid of newVisible) {
                if (oldVisible.has(eid)) {
                    const pos = bodyMap.get(eid)!.GetPosition();
                    const rot = bodyMap.get(eid)!.GetAngle();
                    writer.writeU8(SERVER_PACKET_HEADER.UPDATE_ENTITY);
                    writer.writeU32(eid);
                    writer.writeF32(pixels(pos.x));
                    writer.writeF32(pixels(pos.y));
                    writer.writeF32(rot);
                }
            }

            client.visibleEids = newVisible;

            client.syncBuffer();
        }
    }
}
