// Client Movement System
import { defineSystem, IWorld } from 'bitecs';
import { Q_ClientControls } from '../query';
import { C_ClientControls } from '../component';
import { bodyMap } from '../../EntityFactory';
import { b2Vec2 } from '@box2d/core';

export function MovementSystem(world: IWorld, delta: number) {
    const eids = Q_ClientControls(world);

    for (let i = 0; i < eids.length; i++) {
        const eid = eids[i];
        // const x = C_ClientControls.x[eid];
        // const y = C_ClientControls.y[eid];
        const dir = C_ClientControls.dir[eid];

        let x = 0;
        let y = 0;

        if (dir & 1) y = -1;
        if (dir & 2) x = -1;
        if (dir & 4) y = 1;
        if (dir & 8) x = 1;

        // normalize
        const length = Math.sqrt(x * x + y * y);
        if (length !== 0) {
            x /= length;
            y /= length;
        }

        const rotation = C_ClientControls.rotation[eid];
        const isTurbo = +C_ClientControls.turbo[eid];
        const body = bodyMap.get(eid)!;

        const MOVE_SPEED = 2.5;
        const ACCELERATION = 2;
        // slow down factor (maybe deceleration)
        const DAMPING = 0.98;

        const inputDirection = new b2Vec2(x, y);
        const targetVelocity = new b2Vec2(inputDirection.x * MOVE_SPEED, inputDirection.y * MOVE_SPEED);

        if (isTurbo) {
            targetVelocity.Scale(2);
        }

        const currentVelocity = body.GetLinearVelocity();

        // lerp to target velocity
        const newVelocity = new b2Vec2(
            currentVelocity.x + (targetVelocity.x - currentVelocity.x) * ACCELERATION * delta,
            currentVelocity.y + (targetVelocity.y - currentVelocity.y) * ACCELERATION * delta
        );

        if (x === 0 && y === 0) {
            newVelocity.x *= DAMPING;
            newVelocity.y *= DAMPING;
        }

        body.SetLinearVelocity(newVelocity);
        body.SetAngle(rotation);
    }
}
