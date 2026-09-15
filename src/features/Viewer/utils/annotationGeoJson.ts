import { z } from 'zod';
import { lks94ToWgs84 } from '@/common/utils/coordinates';
import type { StoredSectorAnnotation } from './annotationStorage';

const vector3Schema = z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]);

const annotationGeoJsonSchema = z
    .object({
        type: z.literal('FeatureCollection'),
        name: z.literal('LiDAR LT annotations'),
        features: z
            .array(
                z
                    .object({
                        type: z.literal('Feature'),
                        id: z.string().min(1),
                        geometry: z
                            .object({
                                type: z.literal('Point'),
                                coordinates: z.tuple([
                                    z.number().finite().min(-180).max(180),
                                    z.number().finite().min(-90).max(90),
                                ]),
                            })
                            .strict(),
                        properties: z
                            .object({
                                id: z.string().min(1),
                                sectorId: z.string().regex(/^\d+_\d+$/),
                                title: z.string().trim().min(1).max(200),
                                description: z.string().trim().max(10_000),
                                createdAt: z
                                    .string()
                                    .refine((value) => Number.isFinite(Date.parse(value))),
                                visible: z.boolean(),
                                positionLks94: vector3Schema,
                                cameraPositionLks94: vector3Schema.optional(),
                                cameraTargetLks94: vector3Schema.optional(),
                            })
                            .strict(),
                    })
                    .strict()
            )
            .max(5_000),
    })
    .strict();

type AnnotationGeoJson = z.infer<typeof annotationGeoJsonSchema>;

interface AnnotationGeoJsonDownloadOptions {
    sectorId?: string;
    now?: Date;
}

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

class AnnotationImportError extends Error {}

function createAnnotationGeoJson(
    annotations: readonly StoredSectorAnnotation[]
): AnnotationGeoJson {
    return {
        type: 'FeatureCollection',
        name: 'LiDAR LT annotations',
        features: annotations.map(({ sectorId, annotation }) => {
            const [x, y] = annotation.position;
            const wgs84 = lks94ToWgs84({ type: 'lks94', x, y });

            return {
                type: 'Feature',
                id: annotation.id,
                geometry: {
                    type: 'Point',
                    coordinates: [wgs84.longitude, wgs84.latitude],
                },
                properties: {
                    id: annotation.id,
                    sectorId,
                    title: annotation.title,
                    description: annotation.description,
                    createdAt: annotation.createdAt,
                    visible: annotation.visible,
                    positionLks94: annotation.position,
                    ...(annotation.cameraPosition
                        ? { cameraPositionLks94: annotation.cameraPosition }
                        : {}),
                    ...(annotation.cameraTarget
                        ? { cameraTargetLks94: annotation.cameraTarget }
                        : {}),
                },
            };
        }),
    };
}

export function downloadAnnotationGeoJson(
    annotations: readonly StoredSectorAnnotation[],
    { sectorId, now = new Date() }: AnnotationGeoJsonDownloadOptions = {}
): void {
    const content = JSON.stringify(createAnnotationGeoJson(annotations), null, 2);
    const blob = new Blob([content], { type: 'application/geo+json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    const sectorSuffix = sectorId ? `-${sectorId}` : '';
    link.download = `lidar-lt-annotations${sectorSuffix}-${now.toISOString().slice(0, 10)}.geojson`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export async function readAnnotationGeoJson(file: File): Promise<StoredSectorAnnotation[]> {
    if (file.size > MAX_IMPORT_FILE_SIZE) {
        throw new AnnotationImportError('Annotation import file is too large');
    }

    let input: unknown;
    try {
        input = JSON.parse(await file.text());
    } catch {
        throw new AnnotationImportError('Annotation import file is not valid JSON');
    }

    const parsed = annotationGeoJsonSchema.safeParse(input);
    if (!parsed.success) {
        throw new AnnotationImportError('Annotation import file has an invalid schema');
    }

    const ids = new Set<string>();
    return parsed.data.features.map((feature) => {
        if (feature.id !== feature.properties.id || ids.has(feature.id)) {
            throw new AnnotationImportError('Annotation import file contains invalid IDs');
        }
        ids.add(feature.id);

        const { properties } = feature;
        const hasCameraPosition = properties.cameraPositionLks94 !== undefined;
        const hasCameraTarget = properties.cameraTargetLks94 !== undefined;
        if (hasCameraPosition !== hasCameraTarget) {
            throw new AnnotationImportError('Annotation import file has an incomplete camera pose');
        }

        return {
            sectorId: properties.sectorId,
            annotation: {
                id: properties.id,
                position: properties.positionLks94,
                title: properties.title,
                description: properties.description,
                createdAt: properties.createdAt,
                visible: properties.visible,
                ...(properties.cameraPositionLks94
                    ? { cameraPosition: properties.cameraPositionLks94 }
                    : {}),
                ...(properties.cameraTargetLks94
                    ? { cameraTarget: properties.cameraTargetLks94 }
                    : {}),
            },
        };
    });
}
