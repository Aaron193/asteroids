import { addComponent, addEntity, hasComponent, removeEntity } from 'bitecs';
import { C_Asteroid, C_Position, EID_MAP, ECS_WORLD, Q_Position, C_Rotation, C_Bullet } from './ecs/index';
import { CLIENT_PACKET_HEADER, SERVER_PACKET_HEADER, BufferWriter, BufferReader } from '../../shared/packet/index';
import { EntityTypes } from '../../shared/types';
import { Socket } from './protocol/Socket';
import { Interpolator } from './Interpolator';
import { Sprite } from './Sprite';

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

const drone = new Sprite('assets/images/drone.png');
const asteroid = new Sprite('assets/images/asteroid.png');
const bullet = new Sprite('assets/images/bullet.png');

// we will move this to its own Game class at some point
export const State = {
    // must store server side eid
    cameraEid: -1,
    myEid: -1,
    mouse: {
        x: 0,
        y: 0,
    },
    mouseLastSend: {
        x: 0,
        y: 0,
        timestamp: 0,
    },

    mousedown: false,
};

window.addEventListener('mousemove', function (event: MouseEvent) {
    const x = event.clientX;
    const y = event.clientY;

    State.mouse.x = x;
    State.mouse.y = y;
});

const socket = Socket.instance;
socket.connect();

window.addEventListener('mousedown', function (event: MouseEvent) {
    State.mousedown = true;
    const socket = Socket.instance;
    socket.writer.writeU8(CLIENT_PACKET_HEADER.MOUSE_DOWN);
    socket.send();
});

window.addEventListener('mouseup', function (event: MouseEvent) {
    State.mousedown = false;
    const socket = Socket.instance;
    socket.writer.writeU8(CLIENT_PACKET_HEADER.MOUSE_UP);
    socket.send();
});

window.addEventListener('keydown', function (event: KeyboardEvent) {
    const key = event.key;
    switch (key) {
        case 'Shift':
        case ' ':
            {
                const socket = Socket.instance;
                socket.writer.writeU8(CLIENT_PACKET_HEADER.TURBO_START);
                socket.send();
            }
            break;
    }
});

window.addEventListener('keyup', function (event: KeyboardEvent) {
    const key = event.key;
    switch (key) {
        case 'Shift':
        case ' ':
            {
                const socket = Socket.instance;
                socket.writer.writeU8(CLIENT_PACKET_HEADER.TURBO_END);
                socket.send();
            }
            break;
    }
});

let then = performance.now();
function tick() {
    const now = performance.now();
    const delta = (now - then) / 1000;
    then = now;

    GameUpdate(now, delta);
    GameRender();

    requestAnimationFrame(tick);
}

tick();

function GameUpdate(now: number, delta: number) {
    Interpolator.instance.update();

    // Mouse update
    {
        const lastSend = State.mouseLastSend;

        if (now - lastSend.timestamp > 50 && (lastSend.x !== State.mouse.x || lastSend.y !== State.mouse.y)) {
            const mouse = State.mouse;
            lastSend.x = mouse.x;
            lastSend.y = mouse.y;
            lastSend.timestamp = now;

            const centerX = window.innerWidth * 0.5;
            const centerY = window.innerHeight * 0.5;

            const angle = Math.atan2(mouse.y - centerY, mouse.x - centerX);
            const distFromCenter = Math.sqrt((mouse.x - centerX) ** 2 + (mouse.y - centerY) ** 2);
            const mag = Math.min(1, Math.max(distFromCenter / 100, 0));

            const socket = Socket.instance;
            const writer = socket.writer;

            writer.writeU8(CLIENT_PACKET_HEADER.MOUSE);
            writer.writeF32(angle);
            writer.writeF32(mag);
            socket.send();
            // console.log('sending angle', angle);
        }
    }
}

function GameRender() {
    if (!EID_MAP.has(State.cameraEid)) return;

    const cameraEid = EID_MAP.get(State.cameraEid)!;
    const myEid = EID_MAP.get(State.myEid)!;

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
        const sprite = hasComponent(ECS_WORLD, C_Asteroid, eid) ? asteroid : hasComponent(ECS_WORLD, C_Bullet, eid) ? bullet : drone;
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(
            eid === myEid ? Math.atan2(State.mouse.y - window.innerHeight * 0.5, State.mouse.x - window.innerWidth * 0.5) : C_Rotation.rotation[eid]
        );
        ctx.drawImage(sprite.image, -sprite.halfWidth, -sprite.halfHeight);
        ctx.restore();
    }
    ctx.restore();
}

function drawGrid() {
    const gridSize = 300;
    const eid = EID_MAP.get(State.cameraEid)!;
    const x = C_Position.x[eid];
    const y = C_Position.y[eid];

    // Center grid around the camera position
    const startX = x - (x % gridSize) - window.innerWidth / 2;
    const startY = y - (y % gridSize) - window.innerHeight / 2;

    ctx.save();
    ctx.strokeStyle = 'grey';
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
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
    ctx.restore();
}
