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
            className="pointer-events-none absolute bottom-3 left-[20.5rem] z-20 rounded border border-white/10 bg-black/45 px-1.5 py-0.5 font-mono text-[10px] leading-none text-white/45"
        >
            -- FPS
        </div>
    );
}
