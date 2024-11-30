import { defineQuery } from 'bitecs';
import { C_Body, C_Bullet, C_ClientControls, C_Dynamic, C_Networked } from './component';

export const Q_Moving = defineQuery([C_Body, C_Dynamic, C_Networked]);
export const Q_Networked = defineQuery([C_Networked]);
export const Q_ClientControls = defineQuery([C_ClientControls]);
export const Q_Bullets = defineQuery([C_Bullet]);
