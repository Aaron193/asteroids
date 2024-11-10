import { C_Interpolate, C_Position, C_Rotation, ECS_WORLD, Q_Interpolate } from './ecs';

export class Interpolator {
    private static _instance: Interpolator;

    static get instance(): Interpolator {
        if (!Interpolator._instance) {
            Interpolator._instance = new Interpolator();
        }
        return Interpolator._instance;
    }

    addSnapshot(eid: number) {
        const x = C_Position.x[eid];
        const y = C_Position.y[eid];
        const rotation = C_Rotation.rotation[eid];
        const time = performance.now();

        const buffer = C_Interpolate.buffer[eid];
        const index = C_Interpolate.currIndex[eid];
        buffer[index * 4 + 0] = x;
        buffer[index * 4 + 1] = y;
        buffer[index * 4 + 2] = rotation;
        buffer[index * 4 + 3] = time;

        C_Interpolate.currIndex[eid] = (index + 1) % 16;
    }

    interpolate(eid: number) {
        const buffer = C_Interpolate.buffer[eid];
        const index = C_Interpolate.currIndex[eid];
        const scaledIndex = index * 4;
        const prevIndex = (index + 15) % 16;
        const scaledPrevIndex = prevIndex * 4;

        const x0 = buffer[scaledPrevIndex + 0];
        const y0 = buffer[scaledPrevIndex + 1];
        const rotation0 = buffer[scaledPrevIndex + 2];
        const time0 = buffer[scaledPrevIndex + 3];

        const x1 = buffer[scaledIndex + 0];
        const y1 = buffer[scaledIndex + 1];
        const rotation1 = buffer[scaledIndex + 2];
        const time1 = buffer[scaledIndex + 3];

        const time = performance.now();
        const alpha = (time - time0) / (time1 - time0);

        C_Position.x[eid] = x0 + (x1 - x0) * alpha;
        C_Position.y[eid] = y0 + (y1 - y0) * alpha;
        C_Rotation.rotation[eid] = rotation0 + (rotation1 - rotation0) * alpha;
    }

    update() {
        const eids = Q_Interpolate(ECS_WORLD);
        for (let i = 0; i < eids.length; i++) {
            const eid = eids[i];
            this.interpolate(eid);
        }
    }
}
