import { useEffect, useState } from 'react';
import {
    findGeographicSectorIds,
    loadGeographicSearchIndex,
    normalizeGeographicName,
} from '@/features/GridMap/services/geographicSearchIndex';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

interface SearchResult {
    query: string;
    status: Extract<SearchStatus, 'success' | 'error'>;
    matchedIds: Set<string>;
}

const EMPTY_MATCHED_IDS = new Set<string>();

export function useGeographicSearch(query: string, enabled: boolean) {
    const normalizedQuery = normalizeGeographicName(query);
    const activeQuery = enabled && normalizedQuery.length >= 2 ? normalizedQuery : null;
    const [result, setResult] = useState<SearchResult | null>(null);

    useEffect(() => {
        if (!activeQuery) return;
        let cancelled = false;

        void loadGeographicSearchIndex()
            .then((index) => {
                if (cancelled) return;
                setResult({
                    query: activeQuery,
                    status: 'success',
                    matchedIds: findGeographicSectorIds(index, activeQuery),
                });
            })
            .catch(() => {
                if (cancelled) return;
                setResult({ query: activeQuery, status: 'error', matchedIds: EMPTY_MATCHED_IDS });
            });

        return () => {
            cancelled = true;
        };
    }, [activeQuery]);

    if (!activeQuery) return { status: 'idle' as const, matchedIds: EMPTY_MATCHED_IDS };
    if (result?.query !== activeQuery) {
        return { status: 'loading' as const, matchedIds: EMPTY_MATCHED_IDS };
    }
    return { status: result.status, matchedIds: result.matchedIds };
}
