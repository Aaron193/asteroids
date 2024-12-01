import { App, WebSocket } from 'uWebSockets.js';
import { b2AABB, b2Fixture, b2StepConfig, b2Vec2 } from '@box2d/core';
import NanoTimer from 'nanotimer';
import { Client } from './Client';
import { GameWorld } from './World';
import { bodyMap, EntityFactory, world } from './EntityFactory';
import { C_Camera, C_ClientControls, C_Networked, C_Type, Q_ClientControls } from './ecs/index';
import { SERVER_PACKET_HEADER } from '../../shared/packet/header';
import { hasComponent } from 'bitecs';
import { meters, pixels } from './utils/conversion';
import { EntityTypes } from '../../shared/types';
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

    syncClients();
}

const timer = new NanoTimer();
timer.setInterval(tick, '', timeStepMs + 'm');

const _tmpAABB_ = new b2AABB();

function syncClients() {
    // sync spectating clients
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
