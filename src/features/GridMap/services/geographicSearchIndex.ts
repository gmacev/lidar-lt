import geographicSearchIndexUrl from '@/assets/gvdr-name-sector-index.json?url';

export type GeographicSearchEntry = [normalizedName: string, sectorIds: string[]];

let indexPromise: Promise<GeographicSearchEntry[]> | null = null;

export function normalizeGeographicName(value: string) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('lt')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

export function loadGeographicSearchIndex() {
    indexPromise ??= fetch(geographicSearchIndexUrl)
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Geographic search index returned HTTP ${response.status}`);
            }
            return response.json() as Promise<GeographicSearchEntry[]>;
        })
        .catch((error: unknown) => {
            indexPromise = null;
            throw error;
        });
    return indexPromise;
}

export function findGeographicSectorIds(index: GeographicSearchEntry[], normalizedQuery: string) {
    const tokens = normalizedQuery.split(' ').filter(Boolean);
    if (tokens.length === 0) return new Set<string>();

    const matches = new Set<string>();
    for (let indexPosition = 0; indexPosition < index.length; indexPosition += 1) {
        const entry = index[indexPosition];
        if (!entry) continue;
        const [name, sectorIds] = entry;
        let matchesAll = true;
        for (let tokenIndex = 0; tokenIndex < tokens.length; tokenIndex += 1) {
            const token = tokens[tokenIndex];
            if (!token || !name.includes(token)) {
                matchesAll = false;
                break;
            }
        }
        if (!matchesAll) continue;
        for (let sectorIndex = 0; sectorIndex < sectorIds.length; sectorIndex += 1) {
            const sectorId = sectorIds[sectorIndex];
            if (sectorId) matches.add(sectorId);
        }
    }
    return matches;
}
