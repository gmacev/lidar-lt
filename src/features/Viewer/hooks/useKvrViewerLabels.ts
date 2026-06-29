import { useEffect, useRef } from 'react';
import {
    KVR_MATCH_ORDER,
    type KvrMatch,
    type KvrMatchType,
} from '@/features/Viewer/utils/kvrClient';
import type { ViewerLabel } from '@/features/Viewer/utils/viewerLabels';

interface UseKvrViewerLabelsOptions {
    enabled: boolean;
    matches: KvrMatch[];
    unnamedLabel: string;
    onCenterMatch: (match: KvrMatch) => void;
    onFocusMatch: (match: KvrMatch) => void;
}

const KVR_LABEL_PRIORITY = 10_000;
const centerOrder: KvrMatchType[] = [
    'nearby-object',
    'object-territory',
    'physical-protection-zone',
    'visual-protection-zone',
];

function findFirstMatch(matches: KvrMatch[], order: KvrMatchType[], requireCenter = false) {
    for (const matchType of order) {
        const match = matches.find(
            (candidate) => candidate.matchType === matchType && (!requireCenter || candidate.center)
        );
        if (match) return match;
    }
    return undefined;
}

export function useKvrViewerLabels({
    enabled,
    matches,
    unnamedLabel,
    onCenterMatch,
    onFocusMatch,
}: UseKvrViewerLabelsOptions) {
    const onCenterMatchRef = useRef(onCenterMatch);
    const onFocusMatchRef = useRef(onFocusMatch);
    useEffect(() => {
        onCenterMatchRef.current = onCenterMatch;
        onFocusMatchRef.current = onFocusMatch;
    }, [onCenterMatch, onFocusMatch]);

    if (!enabled) return [];

    const matchesByObject = new Map<string, KvrMatch[]>();
    matches.forEach((match) => {
        const objectMatches = matchesByObject.get(match.objectId) ?? [];
        objectMatches.push(match);
        matchesByObject.set(match.objectId, objectMatches);
    });

    return [...matchesByObject.entries()].flatMap<ViewerLabel>(([objectId, objectMatches]) => {
        const centerMatch = findFirstMatch(objectMatches, centerOrder, true);
        const focusMatch = findFirstMatch(objectMatches, KVR_MATCH_ORDER);
        if (!centerMatch?.center || !focusMatch) return [];

        const namedMatch = objectMatches.find((match) => match.name);
        const codedMatch = objectMatches.find((match) => match.code);
        const text = namedMatch?.name || codedMatch?.code || unnamedLabel;

        return [
            {
                id: objectId,
                source: 'kvr',
                text,
                position: [centerMatch.center.x, centerMatch.center.y],
                priority: KVR_LABEL_PRIORITY,
                tone: 'accent',
                ariaLabel: text,
                onActivate: () => {
                    onCenterMatchRef.current(centerMatch);
                    onFocusMatchRef.current(focusMatch);
                },
            },
        ];
    });
}
