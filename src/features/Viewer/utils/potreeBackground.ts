import {
    POTREE_BACKGROUND_GRADIENT,
    POTREE_LIGHT_BACKGROUND_GRADIENT,
} from '@/features/Viewer/config/viewerConfig';
import type { Potree, PotreeViewer } from '@/common/types/potree';
import type { ResolvedTheme } from '@/common/theme';

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

export function configurePotreeBackgroundTexture(
    PotreeLib: Potree,
    theme: ResolvedTheme
): void {
    const THREE = window.THREE;
    const palette =
        theme === 'light' ? POTREE_LIGHT_BACKGROUND_GRADIENT : POTREE_BACKGROUND_GRADIENT;
    const center = parseHexColor(palette.center);
    const edge = parseHexColor(palette.edge);
    const noiseStrength = palette.noise;

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

export function applyPotreeBackgroundTheme(
    PotreeLib: Potree,
    viewer: PotreeViewer,
    theme: ResolvedTheme
): void {
    configurePotreeBackgroundTexture(PotreeLib, theme);

    const backgroundMaterial = viewer.scene.sceneBG.children
        .map((child) => (child as { material?: unknown }).material)
        .find(
            (material): material is import('three').MeshBasicMaterial =>
                typeof material === 'object' &&
                material !== null &&
                !Array.isArray(material) &&
                'map' in material
        );

    if (!backgroundMaterial) return;

    const previousTexture = backgroundMaterial.map;
    const texture = PotreeLib.Utils.createBackgroundTexture(512, 512);

    texture.minFilter = texture.magFilter = window.THREE.LinearFilter;
    backgroundMaterial.map = texture;
    backgroundMaterial.needsUpdate = true;
    previousTexture?.dispose();
}
