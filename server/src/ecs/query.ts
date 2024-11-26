import { defineQuery } from 'bitecs';
import { C_Body, C_ClientControls, C_Dynamic, C_Networked } from './component';

export const Q_Moving = defineQuery([C_Body, C_Dynamic, C_Networked]);
export const Q_Networked = defineQuery([C_Networked]);
export const Q_ClientControls = defineQuery([C_ClientControls]);
