import { createWorld } from 'bitecs';

export * from './components';
export * from './query';

/**
 * Server to client map of eids
 */
export const EID_MAP = new Map<number, number>();

/**
 * ECS_WORLD: bitecs world
 */
export const ECS_WORLD = createWorld();
