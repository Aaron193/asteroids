import { C_Interpolate, C_Position, C_Rotation, ECS_WORLD, Q_Interpolate } from './ecs';

export class Interpolator {
    private static _instance: Interpolator;
    public static BUFFER_SIZE = 8;
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

        if (!C_Interpolate.initialized[eid]) {
            buffer[0] = x;
            buffer[1] = y;
            buffer[2] = rotation;
            buffer[3] = time;

            C_Interpolate.currIndex[eid] = 1;
            C_Interpolate.initialized[eid] = 1;
            return;
        }

        buffer[index * 4 + 0] = x;
        buffer[index * 4 + 1] = y;
        buffer[index * 4 + 2] = rotation;
        buffer[index * 4 + 3] = time;

        C_Interpolate.currIndex[eid] = (index + 1) % Interpolator.BUFFER_SIZE;
    }

    interpolate(eid: number) {
        if (!C_Interpolate.initialized[eid]) return;

        const buffer = C_Interpolate.buffer[eid];
        const currentTime = performance.now() - Interpolator.LAG;

        let validSnapshots = 0;
        for (let i = 0; i < Interpolator.BUFFER_SIZE; i++) {
            if (buffer[i * 4 + 3] > 0) validSnapshots++;
        }

        // wait for more snapshots
        if (validSnapshots <= 1) {
            const x = buffer[0];
            const y = buffer[1];
            const rotation = buffer[2];

            C_Position.x[eid] = x;
            C_Position.y[eid] = y;
            C_Rotation.rotation[eid] = rotation;
            return;
        }

        // find most recent and previous snapshots
        let latestIndex = -1;
        let prevIndex = -1;
        let latestTime = 0;
        let prevTime = 0;

        for (let i = 0; i < Interpolator.BUFFER_SIZE; i++) {
            const snapshotTime = buffer[i * 4 + 3];
            if (snapshotTime > 0) {
                if (snapshotTime > latestTime) {
                    prevIndex = latestIndex;
                    prevTime = latestTime;
                    latestIndex = i;
                    latestTime = snapshotTime;
                } else if (snapshotTime > prevTime) {
                    prevIndex = i;
                    prevTime = snapshotTime;
                }
            }
        }

        if (latestIndex === -1 || prevIndex === -1) {
            return;
        }

        const x0 = buffer[prevIndex * 4 + 0];
        const y0 = buffer[prevIndex * 4 + 1];
        const rotation0 = buffer[prevIndex * 4 + 2];
        const time0 = buffer[prevIndex * 4 + 3];

        const x1 = buffer[latestIndex * 4 + 0];
        const y1 = buffer[latestIndex * 4 + 1];
        const rotation1 = buffer[latestIndex * 4 + 2];
        const time1 = buffer[latestIndex * 4 + 3];

        // calc velocity
        const timeDelta = time1 - time0;
        const velocityX = timeDelta > 0 ? (x1 - x0) / timeDelta : 0;
        const velocityY = timeDelta > 0 ? (y1 - y0) / timeDelta : 0;

        // calc position
        const timeSinceLastUpdate = currentTime - time1;
        const extrapolatedX = x1 + velocityX * timeSinceLastUpdate;
        const extrapolatedY = y1 + velocityY * timeSinceLastUpdate;

        // extrapolate rotation
        let deltaRotation = this.normalizeAngle(rotation1 - rotation0);
        const rotationVelocity = timeDelta > 0 ? deltaRotation / timeDelta : 0;
        const extrapolatedRotation = this.normalizeAngle(rotation1 + rotationVelocity * timeSinceLastUpdate);

        C_Position.x[eid] = extrapolatedX;
        C_Position.y[eid] = extrapolatedY;
        C_Rotation.rotation[eid] = extrapolatedRotation;
    }

    private normalizeAngle(angle: number): number {
        angle = angle % (2 * Math.PI);
        if (angle > Math.PI) angle -= 2 * Math.PI;
        if (angle < -Math.PI) angle += 2 * Math.PI;
        return angle;
    }

    update() {
        const eids = Q_Interpolate(ECS_WORLD);
        for (let i = 0; i < eids.length; i++) {
            const eid = eids[i];
            this.interpolate(eid);
        }
    }
}
