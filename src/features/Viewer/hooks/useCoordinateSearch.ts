import { useState, useEffect } from 'react';
import debounce from 'lodash/debounce';
import { parseCoordinateInput, wgs84ToLks94 } from '@/common/utils/coordinates';

// Default bird's eye view height in meters
const DEFAULT_VIEW_HEIGHT = 500;

interface Coordinates {
    x: number;
    y: number;
}

interface ParseResult {
    isValid: boolean;
    coordinates: Coordinates | null;
    error: string | null;
}

/**
 * Parse and transform coordinates, updating result state
 */
function processQuery(query: string, setResult: (result: ParseResult) => void) {
    const trimmed = query.trim();
    if (!trimmed) {
        setResult({ isValid: false, coordinates: null, error: null });
        return;
    }

    const parsedCoordinates = parseCoordinateInput(trimmed);

    if (parsedCoordinates) {
        try {
            const lks94 =
                parsedCoordinates.type === 'lks94'
                    ? parsedCoordinates
                    : wgs84ToLks94(parsedCoordinates);
            setResult({
                isValid: true,
                coordinates: { x: lks94.x, y: lks94.y },
                error: null,
            });
        } catch {
            setResult({
                isValid: false,
                coordinates: null,
                error: 'Transformation failed',
            });
        }
    } else {
        setResult({
            isValid: false,
            coordinates: null,
            error: 'Invalid coordinates',
        });
    }
}

export function useCoordinateSearch() {
    const [query, setQuery] = useState('');
    const [parseResult, setParseResult] = useState<ParseResult>({
        isValid: false,
        coordinates: null,
        error: null,
    });

    const debouncedProcess = debounce((q: string) => processQuery(q, setParseResult), 300);

    // Cancel on unmount
    useEffect(() => {
        return () => {
            debouncedProcess.cancel();
        };
    }, [debouncedProcess]);

    // Trigger debounced processing on query change
    useEffect(() => {
        debouncedProcess(query);
    }, [query, debouncedProcess]);

    return {
        query,
        setQuery,
        isValid: parseResult.isValid,
        coordinates: parseResult.coordinates,
        error: parseResult.error,
        defaultHeight: DEFAULT_VIEW_HEIGHT,
    };
}
