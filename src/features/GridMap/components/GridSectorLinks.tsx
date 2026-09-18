import { useEffect, useLayoutEffect, useReducer, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Link } from '@tanstack/react-router';
import { useMap } from '@vis.gl/react-maplibre';
import { useTranslation } from 'react-i18next';
import type { FeatureCollection, Polygon, Position } from 'geojson';

interface GridSectorProperties {
    id: string;
    name: string | null;
}

export type GridSectorCollection = FeatureCollection<Polygon, GridSectorProperties>;

interface GridSectorLinksProps {
    data: GridSectorCollection;
}

function projectRing(
    ring: Position[],
    project: (coordinates: [number, number]) => { x: number; y: number }
) {
    const commands = ring.flatMap((position, index) => {
        const longitude = position[0];
        const latitude = position[1];
        if (longitude === undefined || latitude === undefined) return [];

        const point = project([longitude, latitude]);
        return [`${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`];
    });

    return commands.length >= 3 ? `${commands.join(' ')} Z` : '';
}

/**
 * Provides genuine browser links for WebGL-rendered sectors.
 *
 * The SVG is portaled into MapLibre's canvas container so pointer gestures still
 * bubble through MapLibre's supported interaction surface. It is hidden while
 * the camera moves, then projected once at rest instead of rebuilding thousands
 * of paths on every animation frame.
 */
export function GridSectorLinks({ data }: GridSectorLinksProps) {
    const { t } = useTranslation();
    const { current: mapRef } = useMap();
    const map = mapRef?.getMap();
    const svgRef = useRef<SVGSVGElement>(null);
    const [projectionRevision, refreshProjection] = useReducer((revision) => revision + 1, 0);

    const sectors = map
        ? data.features.map((feature) => ({
              id: feature.properties.id,
              name: feature.properties.name,
              path: feature.geometry.coordinates
                  .map((ring) => projectRing(ring, (coordinates) => map.project(coordinates)))
                  .filter(Boolean)
                  .join(' '),
          }))
        : [];

    useEffect(() => {
        if (!map) return;

        let animationFrame: number | undefined;
        const hideOverlay = () => {
            if (svgRef.current) svgRef.current.style.visibility = 'hidden';
        };
        const updateOverlay = () => {
            hideOverlay();
            if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(refreshProjection);
        };

        map.on('movestart', hideOverlay);
        map.on('moveend', updateOverlay);
        map.on('resize', updateOverlay);
        map.on('load', updateOverlay);
        updateOverlay();

        return () => {
            if (animationFrame !== undefined) cancelAnimationFrame(animationFrame);
            map.off('movestart', hideOverlay);
            map.off('moveend', updateOverlay);
            map.off('resize', updateOverlay);
            map.off('load', updateOverlay);
        };
    }, [map]);

    useLayoutEffect(() => {
        if (svgRef.current) svgRef.current.style.visibility = 'visible';
    }, [projectionRevision]);

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;

        // react-maplibre registers a MapLibre contextmenu listener even when the
        // corresponding React prop is absent. MapLibre then prevents the native
        // menu for the whole canvas container. Keep genuine link context menus
        // inside the link layer instead of letting that event reach MapLibre.
        const preserveNativeLinkMenu = (event: MouseEvent) => {
            if (event.target instanceof Element && event.target.closest('[data-sector-id]')) {
                event.stopPropagation();
            }
        };

        svg.addEventListener('contextmenu', preserveNativeLinkMenu);
        return () => svg.removeEventListener('contextmenu', preserveNativeLinkMenu);
    }, [map]);

    if (!map) return null;

    const canvas = map.getCanvas();
    const canvasContainer = map.getCanvasContainer();

    return createPortal(
        <svg
            ref={svgRef}
            data-testid="grid-sector-links"
            width="100%"
            height="100%"
            viewBox={`0 0 ${canvas.clientWidth} ${canvas.clientHeight}`}
            preserveAspectRatio="none"
            style={{
                position: 'absolute',
                inset: 0,
                zIndex: 1,
                pointerEvents: 'none',
            }}
        >
            {sectors.map(({ id, name, path }) => {
                const cellId = id.replaceAll('/', '_');
                return (
                    <Link
                        key={id}
                        to="/viewer/$cellId"
                        params={{ cellId }}
                        search={{ sectorName: name ?? undefined }}
                        preload={false}
                        draggable={false}
                        data-sector-id={cellId}
                        aria-label={t('grid.openSector', {
                            name: name ?? t('grid.unknownSector'),
                            id,
                        })}
                        style={{ cursor: 'pointer' }}
                    >
                        <path
                            d={path}
                            fill="transparent"
                            fillRule="evenodd"
                            style={{ pointerEvents: 'fill' }}
                        />
                    </Link>
                );
            })}
        </svg>,
        canvasContainer
    );
}
