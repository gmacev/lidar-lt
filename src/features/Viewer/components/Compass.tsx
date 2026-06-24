import { useEffect, useRef, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3 } from 'three';
import type { PotreeViewer } from '@/common/types/potree';

interface CompassProps {
    viewerRef: RefObject<PotreeViewer | null>;
    onOrientNorth: () => void;
}

export function Compass({ viewerRef, onOrientNorth }: CompassProps) {
    const { t } = useTranslation();
    const compassRef = useRef<HTMLDivElement>(null);
    const lastRotationRef = useRef<number | null>(null);

    useEffect(() => {
        const viewer = viewerRef.current;
        let frameId: number | null = null;

        const forward = new Vector3();
        const centerPoint = new Vector3();
        const northOffset = new Vector3(0, 10, 0);
        const northPoint = new Vector3();

        const updateCompass = () => {
            const compassEl = compassRef.current;
            const camera = viewer?.scene?.getActiveCamera();
            if (!camera || !compassEl) return;

            camera.getWorldDirection(forward);
            centerPoint.copy(camera.position).add(forward.multiplyScalar(10));
            northPoint.copy(centerPoint).add(northOffset);

            centerPoint.project(camera);
            northPoint.project(camera);

            const dx = northPoint.x - centerPoint.x;
            const dy = northPoint.y - centerPoint.y;
            if (dx === 0 && dy === 0) return;

            const theta = Math.atan2(dy, dx) * (180 / Math.PI);
            const rotationDeg = 90 - theta;
            const previousRotation = lastRotationRef.current;

            if (previousRotation === null || Math.abs(previousRotation - rotationDeg) > 0.01) {
                compassEl.style.transform = `rotate(${rotationDeg}deg)`;
                lastRotationRef.current = rotationDeg;
            }
        };

        frameId = requestAnimationFrame(updateCompass);
        viewer?.addEventListener('camera_changed', updateCompass);

        return () => {
            if (frameId !== null) {
                cancelAnimationFrame(frameId);
            }
            viewer?.removeEventListener('camera_changed', updateCompass);
        };
    }, [viewerRef]);

    return (
        <button
            type="button"
            data-testid="viewer-compass"
            onClick={onOrientNorth}
            className="flex h-12 w-12 items-center justify-center border-0 bg-transparent p-0 text-white/70 transition-colors hover:text-neon-cyan"
            title={t('viewer.orientNorth')}
            aria-label={t('viewer.orientNorth')}
        >
            {/* Attach the ref here */}
            <div
                ref={compassRef}
                className="relative w-full h-full flex items-center justify-center will-change-transform"
            >
                {/* North Indicator */}
                <div className="absolute top-0 flex flex-col items-center">
                    <span className="text-xs font-bold text-plasma-red mb-[-2px] drop-shadow-md">
                        N
                    </span>
                    <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[12px] border-b-plasma-red filter drop-shadow-sm"></div>
                </div>

                {/* South Indicator */}
                <div className="absolute bottom-1 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[12px] border-t-white/30"></div>

                {/* Ring/Ticks */}
                <div className="absolute w-full h-full border-2 border-white/20 rounded-full shadow-sm" />
                <div className="absolute w-[1px] h-[6px] bg-white/40 top-0 left-1/2 -translate-x-1/2" />
                <div className="absolute w-[1px] h-[6px] bg-white/40 bottom-0 left-1/2 -translate-x-1/2" />
                <div className="absolute w-[6px] h-[1px] bg-white/40 left-0 top-1/2 -translate-y-1/2" />
                <div className="absolute w-[6px] h-[1px] bg-white/40 right-0 top-1/2 -translate-y-1/2" />
            </div>
        </button>
    );
}
