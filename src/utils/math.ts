export const mapRange = (value: number, x1: number, y1: number, x2: number, y2: number): number => 
    (value - x1) * (y2 - x2) / (y1 - x1) + x2;

export const clamp = (value: number, min: number, max: number): number => 
    Math.max(min, Math.min(value, max));

export const round = (value: number, precision: number = 2): number => 
    Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);

export const getRandom = (min: number, max: number): number => 
    Math.random() * (max - min) + min; 