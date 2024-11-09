export const CONVERSION_FACTOR = 100;

export function pixels(meters: number) {
    return meters * CONVERSION_FACTOR;
}

export function meters(pixels: number) {
    return pixels / CONVERSION_FACTOR;
}
