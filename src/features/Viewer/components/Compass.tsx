import { useEffect, useRef, type RefObject } from 'react';
import { Vector3 } from 'three';
import type { PotreeViewer } from '@/types/potree';

interface CompassProps {
    viewerRef: RefObject<PotreeViewer | null>;
}

export function Compass({ viewerRef }: CompassProps) {
    // 1. Use a ref for the DOM element instead of state
    const compassRef = useRef<HTMLDivElement>(null);
    const requestRef = useRef<number | null>(null);

    const updateCompass = () => {
        const viewer = viewerRef.current;
        const compassEl = compassRef.current;

        if (viewer && viewer.scene && compassEl) {
            const camera = viewer.scene.getActiveCamera();
            if (camera) {
                // --- Math Logic ---

                // 1. Get Camera Forward vector
                const forward = new Vector3();
                camera.getWorldDirection(forward);

                // 2. Define a target point in front of the camera
                const centerPoint = camera.position.clone().add(forward.multiplyScalar(10));

                // 3. Define "North" relative to that center point.
                // NOTE: Potree/Geospatial data is usually Z-Up.
                // If Z is up, Y is usually North.
                // If your North arrow points East/West, change this vector.
                const northOffset = new Vector3(0, 10, 0);
                const northPoint = centerPoint.clone().add(northOffset);

                // 4. Project both to 2D screen space
                const p1 = centerPoint.project(camera);
                const p2 = northPoint.project(camera);

                // 5. Calculate angle
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;

                if (dx !== 0 || dy !== 0) {
                    // Calculate angle from +X axis (Standard Math)
                    const theta = Math.atan2(dy, dx) * (180 / Math.PI);

                    // Convert to CSS Rotation:
                    // Math 0 (Right) -> CSS 90
                    // Math 90 (Up)   -> CSS 0
                    const rotationDeg = 90 - theta;

                    // --- DIRECT DOM UPDATE (High Performance) ---
                    compassEl.style.transform = `rotate(${rotationDeg}deg)`;
                }
            }
        }
        requestRef.current = requestAnimationFrame(updateCompass);
    };

    useEffect(() => {
        // Start loop
        requestRef.current = requestAnimationFrame(updateCompass);

        return () => {
            if (requestRef.current !== null) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, []); // Empty dependency array is fine here as refs are stable

    return (
        <div className="w-12 h-12 flex items-center justify-center pointer-events-none select-none">
            {/* Attach the ref here */}
            <div
                ref={compassRef}
                className="relative w-full h-full flex items-center justify-center will-change-transform"
                // Remove the style prop here, it's handled by the ref now
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
        </div>
    );
}
