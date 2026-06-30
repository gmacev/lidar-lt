import { useEffect, useState, type RefObject } from 'react';
import type { PotreeViewer } from '@/common/types/potree';
import { fetchMapLabels, type MapLabelCandidate } from '@/features/Viewer/utils/mapLabelProvider';
import { getViewerWorldBounds, type ViewerLabel } from '@/features/Viewer/utils/viewerLabels';

interface UseMapLabelsOptions {
    enabled: boolean;
    language: string;
    sectorId: string;
    viewerRef: RefObject<PotreeViewer | null>;
}

const EMPTY_CANDIDATES: MapLabelCandidate[] = [];

function getLocalizedName(candidate: MapLabelCandidate, language: string) {
    return language.startsWith('lt')
        ? (candidate.names.lt ?? candidate.names.default)
        : (candidate.names.en ?? candidate.names.latin ?? candidate.names.default);
}

function getLabelEmphasis(category: MapLabelCandidate['category']): ViewerLabel['emphasis'] {
    if (category === 'city' || category === 'town') return 'primary';
    if (
        category === 'village' ||
        category === 'hamlet' ||
        category === 'dwelling' ||
        category === 'island' ||
        category === 'water' ||
        category === 'river' ||
        category === 'stream' ||
        category === 'canal'
    ) {
        return 'secondary';
    }
    return 'tertiary';
}

export function useMapLabels({ enabled, language, sectorId, viewerRef }: UseMapLabelsOptions) {
    const [candidateData, setCandidateData] = useState<{
        sectorId: string;
        values: MapLabelCandidate[];
    } | null>(null);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();
        let frameId = 0;

        const loadWhenReady = () => {
            const viewer = viewerRef.current;
            const bounds = viewer ? getViewerWorldBounds(viewer) : null;
            if (!viewer || !bounds || bounds.isEmpty()) {
                frameId = requestAnimationFrame(loadWhenReady);
                return;
            }

            void fetchMapLabels(
                { minX: bounds.min.x, minY: bounds.min.y, maxX: bounds.max.x, maxY: bounds.max.y },
                controller.signal
            )
                .then((nextCandidates) => {
                    if (controller.signal.aborted) return;
                    frameId = requestAnimationFrame(() => {
                        if (controller.signal.aborted) return;
                        setCandidateData({ sectorId, values: nextCandidates });
                        setError(null);
                    });
                })
                .catch((loadError: unknown) => {
                    if (controller.signal.aborted) return;
                    setCandidateData({ sectorId, values: [] });
                    setError(
                        loadError instanceof Error ? loadError : new Error('Map labels failed')
                    );
                });
        };

        loadWhenReady();
        return () => {
            controller.abort();
            cancelAnimationFrame(frameId);
        };
    }, [enabled, sectorId, viewerRef]);

    const candidates =
        enabled && candidateData?.sectorId === sectorId ? candidateData.values : EMPTY_CANDIDATES;
    const labels: ViewerLabel[] = candidates.map((candidate) => ({
        id: candidate.id,
        source: 'map',
        text: getLocalizedName(candidate, language),
        position: candidate.position,
        priority: candidate.priority,
        emphasis: getLabelEmphasis(candidate.category),
        tone: ['water', 'river', 'stream', 'canal'].includes(candidate.category)
            ? 'water'
            : 'neutral',
    }));

    return {
        labels,
        error: enabled ? error : null,
    };
}
