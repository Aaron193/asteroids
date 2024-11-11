import { createWorld, Types, defineComponent, defineQuery, addEntity, addComponent, pipe, removeEntity } from 'bitecs';
import { C_Body, C_Camera, C_Dynamic, C_Networked, C_Type, Q_Moving } from './ecs/index';
import { GameWorld } from './World';
import { b2Body, b2BodyDef, b2BodyType, b2Vec2, b2FixtureDef, b2CircleShape } from '@box2d/core';
import { EntityTypes } from '../../shared/types';
import { meters, pixels } from './utils/conversion';

export const world = createWorld();

/**
 * A map to store the relationship between entity id and box2d body
 * Used to lookup a body's position via its eid
 */
export const bodyMap = new Map<number, b2Body>();

export class EntityFactory {
    static createSpectator() {
        const eid = addEntity(world);
        addComponent(world, C_Type, eid);
        addComponent(world, C_Camera, eid);
        C_Type.type[eid] = EntityTypes.SPECTATOR;
        // follow some random moving entity
        C_Camera.eid[eid] = getFollowEid();
        return eid;
    }
    static createPlayer() {
        const eid = addEntity(world);
        addComponent(world, C_Type, eid);
        addComponent(world, C_Body, eid);
        addComponent(world, C_Dynamic, eid);
        addComponent(world, C_Networked, eid);
        addComponent(world, C_Camera, eid);

        C_Type.type[eid] = EntityTypes.PLAYER;
        C_Camera.eid[eid] = eid;

        const b2world = GameWorld.instance.world;
        const bodyDef: b2BodyDef = {
            type: b2BodyType.b2_dynamicBody,
            position: { x: 5, y: 5 },
            userData: {
                eid: eid,
            },
        };

        const body = b2world.CreateBody(bodyDef);
        bodyMap.set(eid, body);

        const circle = new b2CircleShape();
        circle.m_radius = meters(10);

        body.CreateFixture({
            shape: circle,
            density: 1.0,
            friction: 0.0,
            restitution: 1.0,
        });

        return eid;
    }
    static createAsteroid() {
        const eid = addEntity(world);
        addComponent(world, C_Type, eid);
        addComponent(world, C_Networked, eid);
        addComponent(world, C_Body, eid);
        addComponent(world, C_Dynamic, eid);

        C_Type.type[eid] = EntityTypes.ASTEROID;

        const positionX = 1;
        const positionY = 1;

        const b2world = GameWorld.instance.world;
        const bodyDef: b2BodyDef = {
            type: b2BodyType.b2_dynamicBody,
            position: { x: positionX, y: positionY },
            userData: {
                eid: eid,
            },
        };

        const body = b2world.CreateBody(bodyDef);
        bodyMap.set(eid, body);

        const circle = new b2CircleShape();
        circle.m_radius = meters(10);

        body.CreateFixture({
            shape: circle,
            density: 1.0,
            friction: 0.0,
            restitution: 1.0,
            filter: {
                categoryBits: 1 << 1,
                maskBits: 1 << 0,
            },
        });

        // const force = new b2Vec2(Math.random() * 100, Math.random() * 100);
        const mag = 0.3;
        const impulse = new b2Vec2(mag * Math.cos(Math.random()), mag * Math.sin(Math.random()));
        // body.ApplyForce(force, body.GetWorldCenter());
        body.ApplyLinearImpulseToCenter(impulse, true);

        return eid;
    }

    static destroyEntity(eid: number) {
        const body = bodyMap.get(eid);
        if (body) {
            GameWorld.instance.world.DestroyBody(body);
            bodyMap.delete(eid);
        }
        removeEntity(world, eid);
    }
}

// get eid of some random moving entity to follow
function getFollowEid() {
    const eids = Q_Moving(world);

    const randomIndex = Math.floor(Math.random() * eids.length);
    return eids[randomIndex];
}
