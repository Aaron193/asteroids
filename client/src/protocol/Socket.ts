import { addComponent, addEntity, removeEntity } from 'bitecs';
import { BufferReader, BufferWriter, SERVER_PACKET_HEADER } from '../../../shared/packet/index';
import { C_Asteroid, C_Interpolate, C_Position, C_Rotation, ECS_WORLD, EID_MAP } from '../ecs';
import { EntityTypes } from '../../../shared/types';
import { State } from '..';
import { Interpolator } from '../Interpolator';

export class Socket {
    private static _instance: Socket;
    ws!: WebSocket;
    writer: BufferWriter = new BufferWriter();
    reader: BufferReader = new BufferReader();
    readonly URL = 'ws://localhost:9001/ws';

    static get instance(): Socket {
        if (!Socket._instance) {
            Socket._instance = new Socket();
        }
        return Socket._instance;
    }

    connect(): void {
        if (this.isOpen()) {
            throw new Error('Socket_connect: Socket is already open!');
        }

        if (this.isConnecting()) {
            throw new Error('Socket_connect: Socket is already connecting!');
        }

        this.ws = new WebSocket(this.URL);
        this.ws.binaryType = 'arraybuffer';
        this.ws.onopen = this.open.bind(this);
        this.ws.onclose = this.close.bind(this);
        this.ws.onerror = this.error.bind(this);
        this.ws.onmessage = this.message.bind(this);
    }

    send(): void {
        if (this.isOpen()) {
            this.ws!.send(this.writer.getBuffer());
            this.writer.clear();
        }
    }

    private isOpen(): boolean {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }

    private isConnecting(): boolean {
        return this.ws && this.ws.readyState === WebSocket.CONNECTING;
    }

    private open() {
        console.log('ws opened');
    }

    private close() {
        console.log('ws closed');
    }

    private error() {
        console.error('ws error');
    }

    private message(event: MessageEvent) {
        if (typeof event === 'string') {
            throw new Error('Received a string from the server! No handler setup for this!');
        }

        const reader = this.reader;
        reader.loadBuffer(new Uint8Array(event.data).buffer);
        while (reader.getOffset() < reader.byteLength()) {
            const header = reader.readU8();

            switch (header) {
                case SERVER_PACKET_HEADER.CREATE_ENTITY:
                    {
                        const serverEid = reader.readU32();
                        const type = reader.readU8();
                        const x = reader.readF32();
                        const y = reader.readF32();
                        const rotation = reader.readF32();

                        const clientEid = addEntity(ECS_WORLD);
                        EID_MAP.set(serverEid, clientEid);

                        addComponent(ECS_WORLD, C_Position, clientEid);
                        C_Position.x[clientEid] = x;
                        C_Position.y[clientEid] = y;
                        addComponent(ECS_WORLD, C_Rotation, clientEid);
                        C_Rotation.rotation[clientEid] = rotation;

                        switch (type) {
                            case EntityTypes.ASTEROID:
                                addComponent(ECS_WORLD, C_Asteroid, clientEid);
                                addComponent(ECS_WORLD, C_Interpolate, clientEid);
                                break;
                            case EntityTypes.PLAYER:
                                addComponent(ECS_WORLD, C_Interpolate, clientEid);
                                break;
                        }

                        Interpolator.instance.addSnapshot(clientEid);
                    }
                    break;
                case SERVER_PACKET_HEADER.DESTROY_ENTITY:
                    {
                        const serverEid = reader.readU32();

                        const clientEid = EID_MAP.get(serverEid)!;
                        removeEntity(ECS_WORLD, clientEid);
                    }
                    break;
                case SERVER_PACKET_HEADER.UPDATE_ENTITY:
                    {
                        const serverEid = reader.readU32();
                        const clientEid = EID_MAP.get(serverEid)!;
                        const x = reader.readF32();
                        const y = reader.readF32();
                        const rotation = reader.readF32();

                        // entities.set(eid, { x, y });
                        C_Position.x[clientEid] = x;
                        C_Position.y[clientEid] = y;
                        C_Rotation.rotation[clientEid] = rotation;

                        Interpolator.instance.addSnapshot(clientEid);
                    }
                    break;
                case SERVER_PACKET_HEADER.SET_CAMERA:
                    {
                        console.log('set camera');
                        const eid = reader.readU32();
                        State.cameraEid = eid;
                    }
                    break;
                case SERVER_PACKET_HEADER.SPAWN_SUCCESS:
                    {
                        console.log('spawn success');
                        (document.querySelector('.join-container') as HTMLDivElement).style.display = 'none';
                    }
                    break;
                default:
                    console.error('Unknown packetId', header);
                    break;
            }
        }
    }
}
