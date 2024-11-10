import { defineQuery } from 'bitecs';
import { C_Interpolate, C_Position, C_Rotation } from './components';

export const Q_Position = defineQuery([C_Position]);
export const Q_Interpolate = defineQuery([C_Position, C_Rotation, C_Interpolate]);
