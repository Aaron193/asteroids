import { createWorld, Types, defineComponent, defineQuery, addEntity, addComponent, pipe, removeEntity } from 'bitecs';
import { C_Body, C_Camera, C_Cid, C_ClientControls, C_Dynamic, C_Networked, C_Type, Q_Moving } from './ecs/index';
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
    private static _instance: EntityFactory;
    private removeEids = new Set<number>();

    static get instance() {
        if (!EntityFactory._instance) {
            EntityFactory._instance = new EntityFactory();
        }
        return EntityFactory._instance;
    }

    static createSpectator(followEid?: number) {
        const eid = addEntity(world);
        addComponent(world, C_Type, eid);
        addComponent(world, C_Camera, eid);
        C_Type.type[eid] = EntityTypes.SPECTATOR;
        // follow some random moving entity
        C_Camera.eid[eid] = followEid || getFollowEid();
        return eid;
    }

    static createPlayer() {
        const eid = addEntity(world);
        addComponent(world, C_Type, eid);
        addComponent(world, C_Body, eid);
        addComponent(world, C_Dynamic, eid);
        addComponent(world, C_Networked, eid);
        addComponent(world, C_Camera, eid);
        addComponent(world, C_ClientControls, eid);

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
        circle.m_radius = meters(25 / 2);

        body.CreateFixture({
            shape: circle,
            density: 1.0,
            friction: 0.0,
            restitution: 0.0,
            filter: {
                categoryBits: GameWorld.CollisionBitMask.DRONE,
                maskBits: GameWorld.CollisionBitMask.OBSTACLE | GameWorld.CollisionBitMask.ASTEROID,
            },
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
        circle.m_radius = meters(55 / 2);

        body.CreateFixture({
            shape: circle,
            density: 1.0,
            friction: 0.0,
            restitution: 1.0,
            filter: {
                categoryBits: GameWorld.CollisionBitMask.ASTEROID,
                maskBits: GameWorld.CollisionBitMask.OBSTACLE,
            },
        });

        body.CreateFixture({
            shape: circle,
            isSensor: true,
            filter: {
                categoryBits: GameWorld.CollisionBitMask.ASTEROID,
                maskBits: GameWorld.CollisionBitMask.DRONE | GameWorld.CollisionBitMask.BULLET,
            },
        });

        // const force = new b2Vec2(Math.random() * 100, Math.random() * 100);
        const mag = 0.5;
        const impulse = new b2Vec2(mag * Math.cos(Math.random()), mag * Math.sin(Math.random()));
        // body.ApplyForce(force, body.GetWorldCenter());
        body.ApplyLinearImpulseToCenter(impulse, true);
        body.ApplyTorque(Math.random() * 0.3);

        return eid;
    }

    static createBullet(x: number, y: number, angle: number) {
        const eid = addEntity(world);
        addComponent(world, C_Type, eid);
        addComponent(world, C_Networked, eid);
        addComponent(world, C_Body, eid);
        addComponent(world, C_Dynamic, eid);

        C_Type.type[eid] = EntityTypes.BULLET;

        const b2world = GameWorld.instance.world;
        const bodyDef: b2BodyDef = {
            type: b2BodyType.b2_dynamicBody,
            position: { x: x, y: y },
            userData: {
                eid: eid,
            },
        };

        const body = b2world.CreateBody(bodyDef);
        bodyMap.set(eid, body);

        const circle = new b2CircleShape();
        circle.m_radius = meters(5);

        body.CreateFixture({
            shape: circle,
            density: 1.0,
            friction: 0.0,
            restitution: 0.0,
            filter: {
                categoryBits: GameWorld.CollisionBitMask.BULLET,
                maskBits: GameWorld.CollisionBitMask.ASTEROID | GameWorld.CollisionBitMask.OBSTACLE,
            },
        });

        const mag = 0.5;
        const impulse = new b2Vec2(mag * Math.cos(angle), mag * Math.sin(angle));
        body.ApplyForce(impulse, body.GetWorldCenter());

        return eid;
    }

    /**
     * Public method for removing an entity
     * Will add the entity to a remove list to be removed at the end of the tick
     * @param eid
     */
    public static removeEntity(eid: number) {
        EntityFactory.instance.removeEids.add(eid);
    }

    /**
     * Remove entities that have been added to the remove list (to be called at the end of the game tick)
     */
    public static removeEntities() {
        for (const eid of EntityFactory.instance.removeEids) {
            EntityFactory.destroyEntity(eid);
        }
        EntityFactory.instance.removeEids.clear();
    }

    /**
     * Internal method for removing an entity
     * @param eid
     */
    private static destroyEntity(eid: number) {
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
