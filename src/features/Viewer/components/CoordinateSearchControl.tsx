import { GlassPanel } from '@/common/components/GlassPanel';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { PotreeViewer } from '@/common/types/potree';
import { useCoordinateSearch } from '@/features/Viewer/hooks/useCoordinateSearch';

interface CoordinateSearchControlProps {
    viewerRef: RefObject<PotreeViewer | null>;
    sectorName?: string;
    cellId: string;
}

export function CoordinateSearchControl({
    viewerRef,
    sectorName,
    cellId,
}: CoordinateSearchControlProps) {
    const { t } = useTranslation();
    const { query, setQuery, isValid, coordinates, defaultHeight } = useCoordinateSearch();

    const handleGo = () => {
        const viewer = viewerRef.current;
        if (!viewer || !coordinates) return;

        const THREE = window.THREE;

        // Move camera to the coordinates with bird's eye view
        viewer.scene.view.position.set(coordinates.x, coordinates.y, defaultHeight);
        // eslint-disable-next-line react-compiler/react-compiler
        viewer.scene.view.pitch = -Math.PI / 2; // Look straight down
        viewer.scene.view.yaw = 0;
        viewer.scene.view.radius = 100;

        // Also look at the point to center it
        viewer.scene.view.lookAt(new THREE.Vector3(coordinates.x, coordinates.y, 0));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && isValid) {
            handleGo();
        }
    };

    return (
        <GlassPanel className="flex flex-col gap-1.5">
            <div className="flex items-center justify-center gap-2">
                {sectorName && (
                    <span className="text-sm font-medium text-neon-amber">{sectorName}</span>
                )}
                <span className="font-medium text-sm text-white/60">{cellId}</span>
            </div>
            <div className="relative flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('search.coordinatePlaceholder')}
                    className={`w-36 rounded border bg-black/60 px-3 py-1.5 text-sm placeholder-gray-500 transition-colors focus:outline-none focus:ring-1 sm:w-48 ${
                        query && !isValid
                            ? 'border-plasma-red/50 text-plasma-red focus:border-plasma-red focus:ring-plasma-red/30'
                            : isValid
                              ? 'border-neon-green/50 text-neon-green focus:border-neon-green focus:ring-neon-green/30'
                              : 'border-white/20 text-white focus:border-neon-cyan focus:ring-neon-cyan/30'
                    }`}
                />
                <button
                    onClick={handleGo}
                    disabled={!isValid}
                    className={`rounded px-3 py-1.5 text-sm font-medium transition-all ${
                        isValid
                            ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan/30 hover:shadow-[0_0_10px_rgba(0,255,255,0.3)]'
                            : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                    }`}
                >
                    {t('search.go')}
                </button>
            </div>
        </GlassPanel>
    );
}
