import { POTREE_BACKGROUND_GRADIENT } from '@/features/Viewer/config/viewerConfig';
import type { Potree } from '@/common/types/potree';

type Rgb = readonly [number, number, number];

function parseHexColor(hex: string): Rgb {
    const normalized = hex.replace('#', '');
    const value = Number.parseInt(normalized, 16);

    if (normalized.length !== 6 || !Number.isFinite(value)) {
        throw new Error(`Invalid background color: ${hex}`);
    }

    return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clampByte(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

export function configurePotreeBackgroundTexture(PotreeLib: Potree): void {
    const THREE = window.THREE;
    const center = parseHexColor(POTREE_BACKGROUND_GRADIENT.center);
    const edge = parseHexColor(POTREE_BACKGROUND_GRADIENT.edge);
    const noiseStrength = POTREE_BACKGROUND_GRADIENT.noise;

    PotreeLib.Utils.createBackgroundTexture = (width: number, height: number) => {
        const size = width * height;
        const data = new Uint8Array(3 * size);

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                const u = 2 * (x / Math.max(1, width - 1)) - 1;
                const v = 2 * (y / Math.max(1, height - 1)) - 1;
                const radial = Math.exp(-(u * u + v * v) * 1.85);
                const noise = ((Math.random() + Math.random()) / 2 - 0.5) * noiseStrength * 255;
                const i = x + width * y;

                data[3 * i] = clampByte(edge[0] + (center[0] - edge[0]) * radial + noise);
                data[3 * i + 1] = clampByte(edge[1] + (center[1] - edge[1]) * radial + noise);
                data[3 * i + 2] = clampByte(edge[2] + (center[2] - edge[2]) * radial + noise);
            }
        }

        const texture = new THREE.DataTexture(data, width, height, THREE.RGBFormat);
        texture.needsUpdate = true;

        return texture;
    };
}
