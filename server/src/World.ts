import { b2World } from '@box2d/core';

export class GameWorld {
    private static _instance: GameWorld;

    world: b2World;

    constructor() {
        this.world = b2World.Create({ x: 0, y: 0 });
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
}
