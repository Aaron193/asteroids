import { App, WebSocket } from 'uWebSockets.js';
import { b2StepConfig } from '@box2d/core';
import NanoTimer from 'nanotimer';
import { Client } from './Client';
import { GameWorld } from './World';
import { EntityFactory, world } from './EntityFactory';
import { MovementSystem } from './ecs/systems/movement';
import { ShootingSystem } from './ecs/systems/shoot';
import { BulletSystem } from './ecs/systems/bullet';

const port = 9001;

export interface SocketUserData {
    client: Client;
}

function hrtimeMs() {
    const time = process.hrtime();
    return time[0] * 1000 + time[1] / 1000000;
}

App()
    .ws('/ws', {
        open(ws: WebSocket<SocketUserData>) {
            console.log('A WebSocket connection has been opened');

            ws.getUserData().client = new Client(ws);
        },
        close(ws, code, message) {
            console.log('A WebSocket connection has been closed');
            const client = ws.getUserData().client;
            Client.clients.remove(client.cid);
            EntityFactory.removeEntity(client.eid);
        },
        message(ws, message, isBinary) {
            if (!isBinary) return;

            const client = ws.getUserData().client;

            client.onSocketMessage(message);
        },
        upgrade: (res, req, context) => {
            console.log('An Http connection wants to become WebSocket, URL: ' + req.getUrl() + '!');

            /* This immediately calls open handler, you must not use res after this call */
            res.upgrade(
                {
                    myData: req.getUrl() /* First argument is UserData (see WebSocket.getUserData()) */,
                },
                /* Spell these correctly */
                req.getHeader('sec-websocket-key'),
                req.getHeader('sec-websocket-protocol'),
                req.getHeader('sec-websocket-extensions'),
                context
            );
        },
    })
    .listen(port, token => {
        if (token) {
            console.log('Listening to port ' + port);
        } else {
            console.log('Failed to listen to port ' + port);
        }
    });

const tps = 10;
const timeStepMs = 1000 / tps;

const stepConfig: b2StepConfig = {
    positionIterations: 2,
    velocityIterations: 6,
};

for (let i = 0; i < 10; i++) {
    EntityFactory.createAsteroid();
}

let then = hrtimeMs();
function tick() {
    const now = hrtimeMs();
    const delta = (now - then) / 1000;
    then = now;

    const physicsWorld = GameWorld.instance.world;
    physicsWorld.Step(1 / tps, stepConfig);

    MovementSystem(world, delta);
    ShootingSystem(world, delta);
    BulletSystem(world, delta);

    EntityFactory.removeEntities();
    Client.refreshCameras();

    Client.syncClients();
}

const timer = new NanoTimer();
timer.setInterval(tick, '', timeStepMs + 'm');
