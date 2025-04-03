export const mapRange = (value, x1, y1, x2, y2) => (value - x1) * (y2 - x2) / (y1 - x1) + x2;

export const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export const round = (value, precision = 2) => Math.round(value * Math.pow(10, precision)) / Math.pow(10, precision);

export const getRandom = (min, max) => Math.random() * (max - min) + min;
