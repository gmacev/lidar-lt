import { useTranslation } from 'react-i18next';
import { useCopyCoordinates } from '@/common/hooks/useCopyCoordinates';
import type { Marker } from '@/features/Viewer/hooks/useMarkers';

interface OverlayMarker extends Marker {
    screenX: number;
    screenY: number;
    size: number;
    visible: boolean;
}

interface MarkerOverlayProps {
    markers: OverlayMarker[];
    onDelete: (id: string) => void;
}

function MarkerOverlayItem({
    marker,
    onDelete,
}: {
    marker: OverlayMarker;
    onDelete: MarkerOverlayProps['onDelete'];
}) {
    const { t } = useTranslation();
    const { copied, copyCoordinates } = useCopyCoordinates();

    return (
        <div
            className="absolute"
            style={{
                left: marker.screenX,
                top: marker.screenY,
                width: marker.size,
                height: marker.size,
                transform: 'translate(-50%, -100%)',
            }}
        >
            <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="100%"
                height="100%"
                aria-hidden="true"
                className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.75)]"
            >
                <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                    fill="#ef4444"
                />
                <circle cx="12" cy="9" r="3.5" fill="#ffffff" />
            </svg>
            <div className="absolute -top-1 left-1/2 flex w-[calc(100%+0.5rem)] min-w-8 -translate-x-1/2 justify-between gap-1">
                <button
                    type="button"
                    aria-label={t('viewerMapStatus.copyCoordinates')}
                    title={
                        copied
                            ? t('viewerMapStatus.coordinatesCopied')
                            : t('viewerMapStatus.copyCoordinates')
                    }
                    onClick={() =>
                        void copyCoordinates({ x: marker.position[0], y: marker.position[1] })
                    }
                    className={`pointer-events-auto flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/80 bg-black/85 shadow-[0_1px_4px_rgba(0,0,0,0.7)] transition hover:border-laser-green hover:text-laser-green ${copied ? 'text-laser-green' : 'text-white'}`}
                >
                    <svg
                        viewBox="0 0 12 12"
                        width="10"
                        height="10"
                        aria-hidden="true"
                        className="block"
                    >
                        {copied ? (
                            <path
                                d="M2.5 6l2.3 2.3L9.5 3.5"
                                fill="none"
                                stroke="currentColor"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="1.5"
                            />
                        ) : (
                            <g fill="none" stroke="currentColor" strokeWidth="1.2">
                                <circle cx="6" cy="6" r="3" />
                                <path d="M6 1v2M6 9v2M1 6h2M9 6h2" strokeLinecap="round" />
                                <circle cx="6" cy="6" r="0.75" fill="currentColor" stroke="none" />
                            </g>
                        )}
                    </svg>
                </button>
                <button
                    type="button"
                    aria-label={t('marker.delete')}
                    title={t('marker.delete')}
                    onClick={() => onDelete(marker.id)}
                    className="pointer-events-auto flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/80 bg-black/85 text-white shadow-[0_1px_4px_rgba(0,0,0,0.7)] transition hover:border-plasma-red hover:text-plasma-red"
                >
                    <svg
                        viewBox="0 0 12 12"
                        width="10"
                        height="10"
                        aria-hidden="true"
                        className="block"
                    >
                        <path
                            d="M3 3l6 6M9 3L3 9"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="1.8"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}

export function MarkerOverlay({ markers, onDelete }: MarkerOverlayProps) {
    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {markers.map((marker) => {
                if (!marker.visible) return null;

                return <MarkerOverlayItem key={marker.id} marker={marker} onDelete={onDelete} />;
            })}
        </div>
    );
}
