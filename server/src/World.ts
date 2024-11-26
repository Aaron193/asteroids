import { b2World, b2Vec2, b2BodyType, b2PolygonShape, b2FixtureDef, b2EdgeShape } from '@box2d/core';
import { meters } from './utils/conversion';

export class GameWorld {
    private static _instance: GameWorld;
    world: b2World;

    private constructor() {
        this.world = b2World.Create({ x: 0, y: 0 });
        this.createWorldBoundaries();
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
                    categoryBits: 1 << 0,
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
