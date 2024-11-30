import { b2World, b2Vec2, b2BodyType, b2PolygonShape, b2FixtureDef, b2EdgeShape, b2ContactListener, b2Contact } from '@box2d/core';
import { meters } from './utils/conversion';
import { EntityFactory, world } from './EntityFactory';
import { C_Cid, C_Type } from './ecs';
import { EntityTypes } from '../../shared/types';
import { Client } from './Client';

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

        // Create a wall
        const createBoarder = (startX: number, startY: number, endX: number, endY: number) => {
            // TODO: make the border an actual entity (eid) so that it can be added to the collision handler nicely
            const body = this.world.CreateBody({
                type: b2BodyType.b2_staticBody,
            });
            const shape = new b2EdgeShape();
            shape.SetTwoSided(new b2Vec2(startX, startY), new b2Vec2(endX, endY));
            body.CreateFixture({
                shape: shape,
                restitution: 0,
                friction: 0.0,
                filter: {
                    categoryBits: GameWorld.CollisionBitMask.OBSTACLE,
                },
            });
        };

        // top
        createBoarder(0, 0, worldWidth, 0);
        // bottom
        createBoarder(0, worldHeight, worldWidth, worldHeight);
        // left
        createBoarder(0, 0, 0, worldHeight);
        // right
        createBoarder(worldWidth, 0, worldWidth, worldHeight);
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
    };

    public static getHandler(typeA: number, typeB: number) {
        return CollisionHandler.handlers[CollisionHandler.generateCollisionHash(typeA, typeB)];
    }

    private static generateCollisionHash(typeA: number, typeB: number): number {
        return typeA < typeB ? (typeA << 8) | typeB : (typeB << 8) | typeA;
    }
}
