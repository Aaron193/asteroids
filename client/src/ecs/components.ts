import { defineComponent, Types } from 'bitecs';

export const C_Position = defineComponent({ x: Types.f32, y: Types.f32 });
export const C_Rotation = defineComponent({ rotation: Types.f32 });
// should this entity's position and rotation be interpolated?
export const C_Interpolate = defineComponent({
    buffer: [Types.f32, 16 * 4], // size * [x,y,rotation,time]
    currIndex: Types.ui8,
});
// type flag components
export const C_Asteroid = defineComponent();
