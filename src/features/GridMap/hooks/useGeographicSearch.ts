import { useEffect, useRef, useState } from 'react';
import {
    findGeographicSectorIds,
    loadGeographicSearchIndex,
    normalizeGeographicName,
} from '@/features/GridMap/services/geographicSearchIndex';

type SearchStatus = 'idle' | 'loading' | 'success' | 'error';

export function useGeographicSearch(query: string, enabled: boolean) {
    const requestId = useRef(0);
    const [status, setStatus] = useState<SearchStatus>('idle');
    const [matchedIds, setMatchedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        const normalizedQuery = normalizeGeographicName(query);
        const currentRequestId = ++requestId.current;

        if (!enabled || normalizedQuery.length < 2) {
            setStatus('idle');
            setMatchedIds(new Set());
            return;
        }

        setStatus('loading');
        setMatchedIds(new Set());
        let cancelled = false;

        void loadGeographicSearchIndex()
            .then((index) => {
                if (cancelled || requestId.current !== currentRequestId) return;
                setMatchedIds(findGeographicSectorIds(index, normalizedQuery));
                setStatus('success');
            })
            .catch(() => {
                if (cancelled || requestId.current !== currentRequestId) return;
                setMatchedIds(new Set());
                setStatus('error');
            });

        return () => {
            cancelled = true;
        };
    }, [enabled, query]);

    return { status, matchedIds };
}
