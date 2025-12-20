import { useState } from 'react';
import type { PotreeViewer, Potree } from '@/common/types/potree';
import { POINT_APPEARANCE_DEFAULTS, type PointShape } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { getShapeEnumValue } from '@/features/Viewer/utils/pointShapeUtils';

interface PointShapeControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

const SHAPE_OPTIONS: { value: PointShape; label: string }[] = [
    { value: 'square', label: 'Kvadratai' },
    { value: 'circle', label: 'Apskritimai' },
    { value: 'paraboloid', label: 'Paraboloidai' },
];

/* eslint-disable react-compiler/react-compiler */
export function PointShapeControl({ viewerRef, initialState, updateUrl }: PointShapeControlProps) {
    const [shape, setShape] = useState<PointShape>(
        initialState.psh ?? POINT_APPEARANCE_DEFAULTS.shape
    );

    const handleShapeChange = (newShape: PointShape) => {
        const viewer = viewerRef.current;
        const PotreeLib: Potree | undefined = window.Potree;

        if (!viewer?.scene?.pointclouds?.length || !PotreeLib) return;

        const shapeValue = getShapeEnumValue(newShape, PotreeLib);

        for (const pointcloud of viewer.scene.pointclouds) {
            // eslint-disable-next-line react-hooks/immutability
            pointcloud.material.shape = shapeValue;
        }

        setShape(newShape);
        updateUrl({ psh: newShape });
    };

    const buttonClass = (isActive: boolean) =>
        `flex-1 py-1.5 text-[11px] font-medium transition-all text-center ${
            isActive
                ? 'bg-laser-green/20 text-laser-green border-laser-green'
                : 'text-white/60 hover:text-white/80 border-white/20 hover:border-white/40 hover:bg-white/5'
        } border rounded`;

    return (
        <div className="flex flex-col gap-1">
            <span className="text-xs text-white/70">Taškų forma</span>
            <div className="flex gap-1">
                {SHAPE_OPTIONS.map((option) => (
                    <button
                        key={option.value}
                        className={buttonClass(shape === option.value)}
                        onClick={() => handleShapeChange(option.value)}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
        </div>
    );
}
