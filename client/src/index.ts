import { addComponent, addEntity, removeEntity } from 'bitecs';
import { C_Asteroid, C_Position, EID_MAP, ECS_WORLD, Q_Position } from './ecs/index';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER, BufferWriter, BufferReader } from '../../shared/packet/index';
import { EntityTypes } from '../../shared/types';

const canvas = document.getElementById('game_canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.onresize = function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

const bufferWriter = new BufferWriter();

const playButton = document.getElementById('play_btn') as HTMLButtonElement;
playButton.onclick = function () {
    const nickname = (document.getElementById('nickname_input') as HTMLInputElement).value;
    console.log('play button clicked', nickname);
    bufferWriter.writeU8(CLIENT_PACKET_HEADER.JOIN_SERVER);
    bufferWriter.writeString(nickname);
    sendBuffer();
};

const ws = new WebSocket('ws://localhost:9001/ws');
ws.binaryType = 'arraybuffer';

ws.onopen = function () {
    console.log('ws opened');
    ws.send('hello from client');
    // ws.send(new Uint8Array([1, 2, 3, 4, 5]));
};
ws.onclose = function () {
    console.log('ws closed');
};
ws.onerror = function () {
    console.error('ws error');
};

// const entities = new Map<number, { x: number; y: number }>();

const reader = new BufferReader();
ws.onmessage = function (event) {
    console.log('ws message', event.data);
    if (typeof event.data === 'string') {
        console.log('Received string:', event.data);
        return;
    }

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

                    const clientEid = addEntity(ECS_WORLD);
                    EID_MAP.set(serverEid, clientEid);
                    addComponent(ECS_WORLD, C_Position, clientEid);
                    C_Position.x[clientEid] = x;
                    C_Position.y[clientEid] = y;

                    switch (type) {
                        case EntityTypes.ASTEROID:
                            addComponent(ECS_WORLD, C_Asteroid, clientEid);
                            break;
                    }

                    console.log('create entity', clientEid, x, y);
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

                    console.log('update entity', clientEid, x, y);
                    // entities.set(eid, { x, y });
                    C_Position.x[clientEid] = x;
                    C_Position.y[clientEid] = y;
                }
                break;
            default:
                console.error('Unknown packetId', header);
                break;
        }
    }
};

let then = performance.now();
function tick() {
    const now = performance.now();
    const delta = (now - then) / 1000;
    then = now;

    GameUpdate(delta);
    GameRender();

    requestAnimationFrame(tick);
}

tick();

function GameUpdate(delta: number) {}

function GameRender() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'red';
    const eids = Q_Position(ECS_WORLD);
    for (let i = 0; i < eids.length; i++) {
        const eid = eids[i];
        const x = C_Position.x[eid];
        const y = C_Position.y[eid];
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fill();
    }
}

function sendBuffer() {
    if (bufferWriter.hasData()) {
        ws.send(bufferWriter.getBuffer());
        bufferWriter.clear();
    }
}
