// Measurement type definitions for type-safe handlers
export const MEASUREMENT_TYPES = [
    'distance',
    'area',
    'volume',
    'profile',
    'flood',
    'angle',
    'azimuth',
    'circle',
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number];
