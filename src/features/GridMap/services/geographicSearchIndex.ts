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

export function findGeographicSectorIds(
    index: GeographicSearchEntry[],
    normalizedQuery: string
) {
    let low = 0;
    let high = index.length;
    while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const name = index[middle]?.[0];
        if (name !== undefined && name < normalizedQuery) low = middle + 1;
        else high = middle;
    }

    const exact = index[low]?.[0] === normalizedQuery ? index[low] : undefined;
    if (exact) return new Set(exact[1]);

    const matches = new Set<string>();
    for (let indexPosition = low; indexPosition < index.length; indexPosition += 1) {
        const entry = index[indexPosition];
        if (!entry) break;
        const [name, sectorIds] = entry;
        if (!name.startsWith(normalizedQuery)) break;
        sectorIds.forEach((sectorId) => matches.add(sectorId));
    }
    return matches;
}
