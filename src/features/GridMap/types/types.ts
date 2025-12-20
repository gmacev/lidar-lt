import { z } from 'zod';

export const GridFeatureSchema = z.object({
    type: z.literal('Feature'),
    properties: z.object({
        id: z.string(),
        name: z.string().nullable(),
    }),
    geometry: z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    }),
});

export const GridSchema = z.object({
    type: z.literal('FeatureCollection'),
    features: z.array(GridFeatureSchema),
});

export type GridFeature = z.infer<typeof GridFeatureSchema>;
export type Grid = z.infer<typeof GridSchema>;
