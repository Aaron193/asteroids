import { Types, defineComponent } from 'bitecs';

// Physics body, moving or non moving entity
export const C_Body = defineComponent();
export const C_Static = defineComponent();
export const C_Dynamic = defineComponent();

export const C_Networked = defineComponent();
export const C_Type = defineComponent({ type: Types.ui32 });
export const C_Camera = defineComponent({ eid: Types.ui32 });
export const C_ClientControls = defineComponent({ x: Types.f32, y: Types.f32, rotation: Types.f32, turbo: Types.ui8 });
export const C_Cid = defineComponent({ cid: Types.ui32 });

// bullet
export const C_Bullet = defineComponent({
    timeLeft: Types.f32,
    damage: Types.f32,
});
