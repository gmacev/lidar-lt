import { useEffect, useRef } from 'react';

export function FpsCounter() {
    const labelRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        let frameId = 0;
        let frameCount = 0;
        let lastUpdate = performance.now();

        const tick = (now: number) => {
            frameCount++;
            const elapsed = now - lastUpdate;

            if (elapsed >= 500) {
                const fps = Math.round((frameCount * 1000) / elapsed);
                if (labelRef.current) {
                    labelRef.current.textContent = `${fps} FPS`;
                }
                frameCount = 0;
                lastUpdate = now;
            }

            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, []);

    return (
        <div
            ref={labelRef}
            className="pointer-events-none flex h-4 w-[50px] shrink-0 items-center justify-center rounded border border-white/10 bg-glass-bg font-mono text-[10px] leading-none text-white/55"
        >
            -- FPS
        </div>
    );
}
