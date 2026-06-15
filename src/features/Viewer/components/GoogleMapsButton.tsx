import { useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { GoogleMapsIcon } from './GoogleMapsIcon';
import { ToolbarToolButton } from './ToolbarToolButton';

// LKS94 projection definition (EPSG:3346)
const LKS94_PROJ =
    '+proj=tmerc +lat_0=0 +lon_0=24 +k=0.9998 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs';

interface GoogleMapsButtonProps {
    viewerRef: RefObject<PotreeViewer | null>;
}

export function GoogleMapsButton({ viewerRef }: GoogleMapsButtonProps) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);

    const handleClick = async () => {
        const viewer = viewerRef.current;
        if (!viewer) return;

        const proj4 = window.proj4;

        // Register LKS94 if not already defined
        if (!proj4.defs('EPSG:3346')) {
            proj4.defs('EPSG:3346', LKS94_PROJ);
        }

        // Get current camera position (LKS94)
        const position = viewer.scene.view.position;
        const x = position.x;
        const y = position.y;

        // Convert LKS94 to WGS84
        const [lon, lat] = proj4('EPSG:3346', 'EPSG:4326', [x, y]);

        // Build Google Maps URL (zoom level 17 for detailed view)
        const url = `https://www.google.com/maps/@${lat.toFixed(6)},${lon.toFixed(6)},17z`;

        // Copy to clipboard
        await navigator.clipboard.writeText(url);

        // Show feedback
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <ToolbarToolButton
            onClick={() => void handleClick()}
            isActive={copied}
            activeClassName="bg-neon-green/30 border-neon-green text-neon-green shadow-[0_0_12px_rgba(0,255,0,0.3)]"
            label={copied ? t('googleMaps.copied') : t('googleMaps.copyLink')}
            icon={copied ? <Icon name="check" size={18} /> : <GoogleMapsIcon size={22} />}
        />
    );
}
