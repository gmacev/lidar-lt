import { useEffect } from 'react';
import type { MeasurementType } from '@/features/Viewer/types/measurement';

export type ExclusiveViewerToolId = MeasurementType | 'annotation' | 'kvr';

export interface ExclusiveViewerTool {
    id: ExclusiveViewerToolId;
    isActive: boolean;
    deactivate: () => void;
}

export function useExclusiveViewerTool(tools: ExclusiveViewerTool[]) {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== 'Escape') return;

            const activeTool = tools.find(({ isActive }) => isActive);
            if (!activeTool) return;

            event.preventDefault();
            activeTool.deactivate();
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [tools]);

    const createHandler = (id: ExclusiveViewerToolId, action: () => void) => () => {
        tools.forEach((tool) => {
            if (tool.id !== id && tool.isActive) tool.deactivate();
        });
        action();
    };

    return { createHandler };
}
