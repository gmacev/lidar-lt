import { useTranslation } from 'react-i18next';
import type { Marker } from '@/features/Viewer/hooks/useMarkers';

interface MarkerOverlayProps {
    markers: Array<
        Marker & {
            screenX: number;
            screenY: number;
            size: number;
            visible: boolean;
        }
    >;
    onDelete: (id: string) => void;
}

export function MarkerOverlay({ markers, onDelete }: MarkerOverlayProps) {
    const { t } = useTranslation();

    return (
        <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
            {markers.map((marker) => {
                if (!marker.visible) return null;

                return (
                    <div
                        key={marker.id}
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
                        <button
                            type="button"
                            aria-label={t('marker.delete')}
                            title={t('marker.delete')}
                            onClick={() => onDelete(marker.id)}
                            className="pointer-events-auto absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-white/80 bg-black/85 text-white shadow-[0_1px_4px_rgba(0,0,0,0.7)] transition hover:border-plasma-red hover:text-plasma-red"
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
                );
            })}
        </div>
    );
}
