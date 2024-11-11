import { C_Interpolate, C_Position, C_Rotation, ECS_WORLD, Q_Interpolate } from './ecs';

export class Interpolator {
    private static _instance: Interpolator;
    public static BUFFER_SIZE = 16;
    public static LAG = 100;

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

        C_Interpolate.currIndex[eid] = (index + 1) % Interpolator.BUFFER_SIZE;
    }

    interpolate(eid: number) {
        const buffer = C_Interpolate.buffer[eid];
        const currentTime = performance.now() - Interpolator.LAG;

        let prevIndex = C_Interpolate.currIndex[eid];
        let nextIndex = (prevIndex + 1) % Interpolator.BUFFER_SIZE;

        let loopCounter = 0;

        while (buffer[nextIndex * 4 + 3] > 0 && buffer[nextIndex * 4 + 3] < currentTime) {
            loopCounter++;
            if (loopCounter > Interpolator.BUFFER_SIZE) return;
            prevIndex = nextIndex;
            nextIndex = (nextIndex + 1) % Interpolator.BUFFER_SIZE;
        }

        const x0 = buffer[prevIndex * 4 + 0];
        const y0 = buffer[prevIndex * 4 + 1];
        const rotation0 = buffer[prevIndex * 4 + 2];
        const time0 = buffer[prevIndex * 4 + 3];

        const x1 = buffer[nextIndex * 4 + 0];
        const y1 = buffer[nextIndex * 4 + 1];
        const rotation1 = buffer[nextIndex * 4 + 2];
        const time1 = buffer[nextIndex * 4 + 3];

        const alpha = (currentTime - time0) / (time1 - time0);

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
