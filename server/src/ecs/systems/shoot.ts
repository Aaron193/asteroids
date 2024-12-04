import { IWorld } from 'bitecs';
import { C_ClientControls } from '../component';
import { Q_ClientControls } from '../query';
import { bodyMap, EntityFactory } from '../../EntityFactory';
import { b2Vec2 } from '@box2d/core';

export function ShootingSystem(world: IWorld, delta: number) {
    const eids = Q_ClientControls(world);

    for (let i = 0; i < eids.length; i++) {
        const eid = eids[i];
        const rotation = C_ClientControls.rotation[eid];
        const isShooting = +C_ClientControls.shooting[eid];
        const body = bodyMap.get(eid)!;

        if (isShooting) {
            const position = body.GetPosition();
            EntityFactory.createBullet(eid, position.x, position.y, rotation);
        }
    }
}
