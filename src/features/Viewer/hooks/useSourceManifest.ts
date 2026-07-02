import { useEffect, useState } from 'react';

interface SourceManifestBounds {
    minx: number;
    miny: number;
    maxx: number;
    maxy: number;
}

export interface SourceManifest {
    sourceFileDateRange?: {
        from?: string | null;
        to?: string | null;
    };
    bounds?: SourceManifestBounds;
    sourceFiles?: Array<{
        bounds?: SourceManifestBounds;
    }>;
}

interface SourceManifestState {
    coverageBounds: Array<{
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }>;
    manifest: SourceManifest | null;
    settled: boolean;
    url: string;
}

const EMPTY_COVERAGE_BOUNDS: SourceManifestState['coverageBounds'] = [];

function getCoverageBounds(manifest: SourceManifest | null) {
    const sourceBounds = manifest?.sourceFiles
        ?.map((sourceFile) => sourceFile.bounds)
        .filter((bounds) => bounds !== undefined)
        .map((bounds) => ({
            minX: bounds.minx,
            minY: bounds.miny,
            maxX: bounds.maxx,
            maxY: bounds.maxy,
        }));
    if (sourceBounds?.length) return sourceBounds;
    return manifest?.bounds
        ? [
              {
                  minX: manifest.bounds.minx,
                  minY: manifest.bounds.miny,
                  maxX: manifest.bounds.maxx,
                  maxY: manifest.bounds.maxy,
              },
          ]
        : [];
}

export function useSourceManifest(url: string) {
    const [state, setState] = useState<SourceManifestState | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        void fetch(url, { signal: controller.signal })
            .then((response) => (response.ok ? response.json() : null))
            .then((manifest: SourceManifest | null) => {
                setState({
                    coverageBounds: getCoverageBounds(manifest),
                    manifest,
                    settled: true,
                    url,
                });
            })
            .catch((error: unknown) => {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                setState({ coverageBounds: [], manifest: null, settled: true, url });
            });

        return () => controller.abort();
    }, [url]);

    if (state?.url !== url) {
        return { coverageBounds: EMPTY_COVERAGE_BOUNDS, manifest: null, settled: false };
    }
    return {
        coverageBounds: state.coverageBounds,
        manifest: state.manifest,
        settled: state.settled,
    };
}
