import maplibregl, { type AddProtocolAction } from 'maplibre-gl';

const GEOPORTAL_PROTOCOL = 'geoportal';
const GEOPORTAL_TILE_BASE_URL =
    'https://www.geoportal.lt/arcgis/rest/services/geoportal_public/background_Lietuva-102100/MapServer/export';
const WEB_MERCATOR_HALF_WORLD = 20_037_508.342789244;

export const GEOPORTAL_MIN_MAP_ZOOM = 6;
export const GEOPORTAL_MAX_MAP_ZOOM = 18;
export const GEOPORTAL_LOGICAL_TILE_SIZE = 256;
export const GEOPORTAL_IMAGE_SIZE = 512;

const DARK_TILE_CACHE_LIMIT = 96;
const DARK_TILE_JPEG_QUALITY = 0.94;

// Centralized dark-cartography tuning. Luminance is inverted while chroma keeps its
// original direction, so forests stay green and water stays blue instead of becoming
// the complementary colors produced by a direct RGB inversion.
const DARK_TRANSFORM = {
    maximumLuminance: 0.86,
    invertedLuminanceRange: 0.74,
    contrast: 1.18,
    chroma: 1.15,
} as const;

interface GeoportalTileCoordinates {
    zoom: number;
    x: number;
    y: number;
}

type GeoportalTheme = 'light' | 'dark';

interface DecodedTile {
    image: CanvasImageSource;
    release: () => void;
}

const darkTileCache = new Map<string, ArrayBuffer>();
let protocolRegistered = false;

export function buildGeoportalTileUrl({ zoom, x, y }: GeoportalTileCoordinates): string | null {
    const tileCount = 2 ** zoom;
    if (
        !Number.isInteger(zoom) ||
        zoom < GEOPORTAL_MIN_MAP_ZOOM ||
        zoom > GEOPORTAL_MAX_MAP_ZOOM ||
        !Number.isInteger(x) ||
        !Number.isInteger(y) ||
        x < 0 ||
        y < 0 ||
        x >= tileCount ||
        y >= tileCount
    ) {
        return null;
    }

    const worldSize = WEB_MERCATOR_HALF_WORLD * 2;
    const tileSpan = worldSize / tileCount;
    const minX = -WEB_MERCATOR_HALF_WORLD + x * tileSpan;
    const maxX = minX + tileSpan;
    const maxY = WEB_MERCATOR_HALF_WORLD - y * tileSpan;
    const minY = maxY - tileSpan;
    const parameters = new URLSearchParams({
        bbox: `${minX},${minY},${maxX},${maxY}`,
        bboxSR: '3857',
        imageSR: '3857',
        size: `${GEOPORTAL_IMAGE_SIZE},${GEOPORTAL_IMAGE_SIZE}`,
        format: 'jpg',
        transparent: 'false',
        f: 'image',
    });

    return `${GEOPORTAL_TILE_BASE_URL}?${parameters.toString()}`;
}

export function getGeoportalTileTemplate(theme: GeoportalTheme): string {
    return `${GEOPORTAL_PROTOCOL}://${theme}/{z}/{x}/{y}`;
}

export function transformGeoportalDarkPixels(pixels: Uint8ClampedArray): void {
    for (let index = 0; index < pixels.length; index += 4) {
        const red = (pixels[index] ?? 0) / 255;
        const green = (pixels[index + 1] ?? 0) / 255;
        const blue = (pixels[index + 2] ?? 0) / 255;
        const luminance = red * 0.2126 + green * 0.7152 + blue * 0.0722;
        const invertedLuminance =
            DARK_TRANSFORM.maximumLuminance - DARK_TRANSFORM.invertedLuminanceRange * luminance;
        const contrastedLuminance = (invertedLuminance - 0.5) * DARK_TRANSFORM.contrast + 0.5;
        pixels[index] = toByte(contrastedLuminance + (red - luminance) * DARK_TRANSFORM.chroma);
        pixels[index + 1] = toByte(
            contrastedLuminance + (green - luminance) * DARK_TRANSFORM.chroma
        );
        pixels[index + 2] = toByte(
            contrastedLuminance + (blue - luminance) * DARK_TRANSFORM.chroma
        );
    }
}

function registerGeoportalProtocol(): void {
    if (protocolRegistered) return;

    maplibregl.addProtocol(GEOPORTAL_PROTOCOL, loadGeoportalTile);
    protocolRegistered = true;
}

const loadGeoportalTile: AddProtocolAction = async (request, abortController) => {
    const parsedRequest = parseProtocolUrl(request.url);
    if (!parsedRequest) {
        throw new Error(`Unsupported Geoportal tile URL: ${request.url}`);
    }

    const sourceUrl = buildGeoportalTileUrl(parsedRequest);
    if (!sourceUrl) {
        throw new Error(`Geoportal tile is outside the supported cache: ${request.url}`);
    }

    const cacheKey = `${parsedRequest.zoom}/${parsedRequest.x}/${parsedRequest.y}`;
    if (parsedRequest.theme === 'dark') {
        const cachedTile = getCachedDarkTile(cacheKey);
        if (cachedTile) return { data: cachedTile.slice(0) };
    }

    const response = await fetch(sourceUrl, {
        signal: abortController.signal,
        cache: 'default',
    });

    if (!response.ok) {
        throw new Error(`Geoportal tile returned HTTP ${response.status}`);
    }

    const originalTile = await response.arrayBuffer();
    const responseMetadata = {
        cacheControl: response.headers.get('cache-control'),
        expires: response.headers.get('expires'),
    };

    if (parsedRequest.theme === 'light') {
        return { data: originalTile, ...responseMetadata };
    }

    try {
        const darkTile = await createDarkTile(originalTile, abortController.signal);
        cacheDarkTile(cacheKey, darkTile.slice(0));
        return { data: darkTile, ...responseMetadata };
    } catch {
        throwIfAborted(abortController.signal);
        return { data: originalTile, ...responseMetadata };
    }
};

function parseProtocolUrl(url: string) {
    const match = /^geoportal:\/\/(light|dark)\/(\d+)\/(\d+)\/(\d+)$/.exec(url);
    if (!match) return null;

    const theme = match[1];
    const zoom = Number(match[2]);
    const x = Number(match[3]);
    const y = Number(match[4]);

    if (theme !== 'light' && theme !== 'dark') return null;

    return { theme, zoom, x, y };
}

async function createDarkTile(originalTile: ArrayBuffer, signal: AbortSignal) {
    throwIfAborted(signal);

    const decodedTile = await decodeTile(new Blob([originalTile], { type: 'image/jpeg' }), signal);

    try {
        throwIfAborted(signal);
        const canvas = document.createElement('canvas');
        canvas.width = GEOPORTAL_IMAGE_SIZE;
        canvas.height = GEOPORTAL_IMAGE_SIZE;

        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) throw new Error('Canvas 2D is unavailable');

        context.drawImage(decodedTile.image, 0, 0, canvas.width, canvas.height);
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        transformGeoportalDarkPixels(imageData.data);
        context.putImageData(imageData, 0, 0);

        const transformedBlob = await canvasToBlob(canvas, signal);
        throwIfAborted(signal);
        return transformedBlob.arrayBuffer();
    } finally {
        decodedTile.release();
    }
}

async function decodeTile(blob: Blob, signal: AbortSignal): Promise<DecodedTile> {
    if (typeof createImageBitmap === 'function') {
        const imageBitmap = await createImageBitmap(blob);
        if (signal.aborted) {
            imageBitmap.close();
            throwAbortError();
        }

        return {
            image: imageBitmap,
            release: () => imageBitmap.close(),
        };
    }

    return decodeTileWithImageElement(blob, signal);
}

function decodeTileWithImageElement(blob: Blob, signal: AbortSignal): Promise<DecodedTile> {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(blob);
        const image = new Image();

        const cleanup = () => {
            signal.removeEventListener('abort', handleAbort);
            URL.revokeObjectURL(objectUrl);
        };
        const handleAbort = () => {
            cleanup();
            image.src = '';
            reject(createAbortError());
        };

        image.onload = () => {
            cleanup();
            resolve({
                image,
                release: () => {
                    image.src = '';
                },
            });
        };
        image.onerror = () => {
            cleanup();
            reject(new Error('Geoportal tile image could not be decoded'));
        };
        signal.addEventListener('abort', handleAbort, { once: true });
        image.src = objectUrl;
    });
}

function canvasToBlob(canvas: HTMLCanvasElement, signal: AbortSignal): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (signal.aborted) {
                    reject(createAbortError());
                } else if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Geoportal dark tile could not be encoded'));
                }
            },
            'image/jpeg',
            DARK_TILE_JPEG_QUALITY
        );
    });
}

function getCachedDarkTile(key: string): ArrayBuffer | undefined {
    const cachedTile = darkTileCache.get(key);
    if (!cachedTile) return undefined;

    darkTileCache.delete(key);
    darkTileCache.set(key, cachedTile);
    return cachedTile;
}

function cacheDarkTile(key: string, tile: ArrayBuffer): void {
    darkTileCache.delete(key);
    darkTileCache.set(key, tile);

    while (darkTileCache.size > DARK_TILE_CACHE_LIMIT) {
        const oldestKey = darkTileCache.keys().next().value;
        if (typeof oldestKey !== 'string') break;
        darkTileCache.delete(oldestKey);
    }
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throwAbortError();
}

function throwAbortError(): never {
    throw createAbortError();
}

function createAbortError(): DOMException {
    return new DOMException('The tile request was cancelled', 'AbortError');
}

function toByte(value: number): number {
    return Math.round(Math.max(0, Math.min(1, value)) * 255);
}

registerGeoportalProtocol();
