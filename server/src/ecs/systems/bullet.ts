import { IWorld } from 'bitecs';
import { C_Bullet } from '../component';
import { Q_Bullets } from '../query';
import { EntityFactory } from '../../EntityFactory';

export function BulletSystem(world: IWorld, delta: number) {
    const eids = Q_Bullets(world);

    for (let i = 0; i < eids.length; i++) {
        const eid = eids[i];

        const timeLeft = C_Bullet.timeLeft[eid];
        C_Bullet.timeLeft[eid] = timeLeft - delta;

        if (timeLeft <= 0) {
            EntityFactory.removeEntity(eid);
        }
    }
}
