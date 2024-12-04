import { b2World, b2Vec2, b2BodyType, b2PolygonShape, b2FixtureDef, b2EdgeShape, b2ContactListener, b2Contact } from '@box2d/core';
import { meters } from './utils/conversion';
import { EntityFactory, world } from './EntityFactory';
import { C_Body, C_Bullet, C_Cid, C_Static, C_Type } from './ecs';
import { EntityTypes } from '../../shared/types';
import { Client } from './Client';
import { addComponent, addEntity } from 'bitecs';

export class GameWorld {
    private static _instance: GameWorld;
    world: b2World;

    static CollisionBitMask = {
        OBSTACLE: 1 << 0,
        DRONE: 1 << 1,
        ASTEROID: 1 << 2,
        BULLET: 1 << 3,
    };

    private constructor() {
        this.world = b2World.Create({ x: 0, y: 0 });
        this.createWorldBoundaries();

        const listener = new b2ContactListener();

        listener.BeginContact = (contact: b2Contact) => {
            const fixtureA = contact.GetFixtureA();
            const fixtureB = contact.GetFixtureB();

            const bodyA = fixtureA.GetBody();
            const bodyB = fixtureB.GetBody();

            const dataA = bodyA.GetUserData() as { eid: number };
            const dataB = bodyB.GetUserData() as { eid: number };

            if (dataA && dataB) {
                const eidA = dataA.eid;
                const eidB = dataB.eid;

                const typeA = C_Type.type[eidA];
                const typeB = C_Type.type[eidB];

                const handler = CollisionHandler.getHandler(typeA, typeB);
                if (handler) {
                    handler.BeginContact(eidA, eidB);
                }
            }
        };

        listener.EndContact = contact => {
            const fixtureA = contact.GetFixtureA();
            const fixtureB = contact.GetFixtureB();

            const bodyA = fixtureA.GetBody();
            const bodyB = fixtureB.GetBody();

            const dataA = bodyA.GetUserData() as { eid: number };
            const dataB = bodyB.GetUserData() as { eid: number };

            if (dataA && dataB) {
                const eidA = dataA.eid;
                const eidB = dataB.eid;

                const typeA = C_Type.type[eidA];
                const typeB = C_Type.type[eidB];

                const handler = CollisionHandler.getHandler(typeA, typeB);
                if (handler) {
                    handler.EndContact(eidA, eidB);
                }
            }
        };

        this.world.SetContactListener(listener);
    }

    /**
     * Load singleton instance
     */
    static get instance() {
        if (!GameWorld._instance) {
            GameWorld._instance = new GameWorld();
        }
        return GameWorld._instance;
    }

    /**
     * Create boundaries for the game world
     */
    private createWorldBoundaries() {
        const worldWidth = meters(5000);
        const worldHeight = meters(5000);

        const createBorder = (startX: number, startY: number, endX: number, endY: number) => {
            const eid = addEntity(world);
            addComponent(world, C_Type, eid);
            addComponent(world, C_Body, eid);
            addComponent(world, C_Static, eid);

            C_Type.type[eid] = EntityTypes.BORDER;

            const body = this.world.CreateBody({
                type: b2BodyType.b2_staticBody,
                userData: {
                    eid: eid,
                },
            });

            const shape = new b2EdgeShape();
            shape.SetTwoSided(new b2Vec2(startX, startY), new b2Vec2(endX, endY));
            body.CreateFixture({
                shape: shape,
                restitution: 0,
                friction: 0.0,
                filter: {
                    categoryBits: GameWorld.CollisionBitMask.OBSTACLE,
                    maskBits: GameWorld.CollisionBitMask.DRONE | GameWorld.CollisionBitMask.ASTEROID | GameWorld.CollisionBitMask.BULLET,
                },
            });

            return eid;
        };

        // top
        createBorder(0, 0, worldWidth, 0);
        // // bottom
        createBorder(0, worldHeight, worldWidth, worldHeight);
        // // left
        createBorder(0, 0, 0, worldHeight);
        // // right
        createBorder(worldWidth, 0, worldWidth, worldHeight);
    }
}

class CollisionHandler {
    private static handlers = {
        [CollisionHandler.generateCollisionHash(EntityTypes.PLAYER, EntityTypes.ASTEROID)]: {
            BeginContact: (eidA: number, eidB: number) => {
                const typeA = C_Type.type[eidA];

                const player = typeA === EntityTypes.PLAYER ? eidA : eidB;
                const asteroid = typeA === EntityTypes.ASTEROID ? eidA : eidB;

                const cid = C_Cid.cid[player];
                const client = Client.clients.get(cid)!;
                client.onDied(asteroid);
            },
            EndContact: (eidA: number, eidB: number) => {},
        },
        [CollisionHandler.generateCollisionHash(EntityTypes.BULLET, EntityTypes.ASTEROID)]: {
            BeginContact: (eidA: number, eidB: number) => {
                const typeA = C_Type.type[eidA];

                const bullet = typeA === EntityTypes.BULLET ? eidA : eidB;
                const asteroid = typeA === EntityTypes.ASTEROID ? eidA : eidB;

                EntityFactory.removeEntity(asteroid);
            },
            EndContact: (eidA: number, eidB: number) => {},
        },
        [CollisionHandler.generateCollisionHash(EntityTypes.BULLET, EntityTypes.BORDER)]: {
            BeginContact: (eidA: number, eidB: number) => {
                const typeA = C_Type.type[eidA];

                const bullet = typeA === EntityTypes.BULLET ? eidA : eidB;
                const border = typeA === EntityTypes.BORDER ? eidA : eidB;

                EntityFactory.removeEntity(bullet);
                console.log('Bullet hit border');
            },
            EndContact: (eidA: number, eidB: number) => {},
        },
        [CollisionHandler.generateCollisionHash(EntityTypes.BULLET, EntityTypes.PLAYER)]: {
            BeginContact: (eidA: number, eidB: number) => {
                const typeA = C_Type.type[eidA];

                const bullet = typeA === EntityTypes.BULLET ? eidA : eidB;
                const player = typeA === EntityTypes.PLAYER ? eidA : eidB;

                const owner = C_Bullet.owner[bullet];

                if (owner === player) return;

                EntityFactory.removeEntity(bullet);
                const client = Client.clients.get(C_Cid.cid[player])!;
                client.onDied(owner);
            },
            EndContact: (eidA: number, eidB: number) => {},
        },
    };

    public static getHandler(typeA: number, typeB: number) {
        return CollisionHandler.handlers[CollisionHandler.generateCollisionHash(typeA, typeB)];
    }

    private static generateCollisionHash(typeA: number, typeB: number): number {
        return typeA < typeB ? (typeA << 8) | typeB : (typeB << 8) | typeA;
    }
}
