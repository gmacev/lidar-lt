import { useEffect, useRef, useState } from 'react';
import { formatCoordinateForClipboard, type Lks94Coordinates } from '@/common/utils/coordinates';

export function useCopyCoordinates() {
    const [copied, setCopied] = useState(false);
    const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        };
    }, []);

    const copyCoordinates = async (coordinate: Pick<Lks94Coordinates, 'x' | 'y'>) => {
        await navigator.clipboard.writeText(formatCoordinateForClipboard(coordinate));
        setCopied(true);

        if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
        copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1200);
    };

    return { copied, copyCoordinates };
}
