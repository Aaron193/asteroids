import { addComponent, addEntity, removeEntity } from 'bitecs';
import { C_Asteroid, C_Position, EID_MAP, ECS_WORLD, Q_Position } from './ecs/index';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER, BufferWriter, BufferReader } from '../../shared/packet/index';
import { EntityTypes } from '../../shared/types';
import { Socket } from './protocol/Socket';
import { Interpolator } from './Interpolator';

const canvas = document.getElementById('game_canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.onresize = function () {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
};

const playButton = document.getElementById('play_btn') as HTMLButtonElement;
playButton.onclick = function () {
    const nickname = (document.getElementById('nickname_input') as HTMLInputElement).value;
    console.log('play button clicked', nickname);
    const socket = Socket.instance;
    socket.writer.writeU8(CLIENT_PACKET_HEADER.JOIN_SERVER);
    socket.writer.writeString(nickname);
    socket.send();
};

const socket = Socket.instance;
socket.connect();

// we will move this to its own Game class at some point
export const State = {
    // must store server side eid
    cameraEid: -1,
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

function GameUpdate(delta: number) {
    Interpolator.instance.update();
}

function GameRender() {
    if (!EID_MAP.has(State.cameraEid)) return;

    const cameraEid = EID_MAP.get(State.cameraEid)!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(window.innerWidth * 0.5, window.innerHeight * 0.5);
    ctx.scale(1, 1);
    ctx.translate(-C_Position.x[cameraEid], -C_Position.y[cameraEid]);

    drawGrid();
    const eids = Q_Position(ECS_WORLD);
    for (let i = 0; i < eids.length; i++) {
        const eid = eids[i];
        const x = C_Position.x[eid];
        const y = C_Position.y[eid];
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, 2 * Math.PI);
        ctx.fillStyle = eid === cameraEid ? 'blue' : 'red';
        ctx.fill();
    }
    ctx.restore();
}

function drawGrid() {
    const gridSize = 100;
    const eid = EID_MAP.get(State.cameraEid)!;
    const x = C_Position.x[eid];
    const y = C_Position.y[eid];

    // Center grid around the camera position
    const startX = x - (x % gridSize) - window.innerWidth / 2;
    const startY = y - (y % gridSize) - window.innerHeight / 2;

    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();

    // Draw vertical lines
    for (let i = startX; i < x + window.innerWidth / 2; i += gridSize) {
        ctx.moveTo(i, startY);
        ctx.lineTo(i, y + window.innerHeight / 2);
    }

    // Draw horizontal lines
    for (let j = startY; j < y + window.innerHeight / 2; j += gridSize) {
        ctx.moveTo(startX, j);
        ctx.lineTo(x + window.innerWidth / 2, j);
    }

    ctx.stroke();
}
