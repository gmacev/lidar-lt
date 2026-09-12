import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gridData from '@/assets/grid.json';
import { GlassPanel, Icon, Popover, type IconName } from '@/common/components';

type Direction =
    'north' | 'northEast' | 'east' | 'southEast' | 'south' | 'southWest' | 'west' | 'northWest';

interface Sector {
    id: string;
    name: string | null;
}

interface SectorNavigationProps {
    cellId: string;
    onNavigate: (sector: Sector) => void;
    onRecenter: () => void;
}

interface DirectionConfigBase {
    columnOffset: number;
    direction: Direction;
    outerCornerClassName?: string;
    positionClassName: string;
    rowOffset: number;
    separatorClassName: string;
}

type DirectionConfig = DirectionConfigBase &
    ({ kind: 'cardinal'; icon: IconName } | { kind: 'corner'; rotationClassName: string });

const sectors = new Map<string, Sector>(
    gridData.features.map((feature) => [
        feature.properties.id,
        {
            id: feature.properties.id,
            name: feature.properties.name,
        },
    ])
);

const directions: DirectionConfig[] = [
    {
        direction: 'northWest',
        kind: 'corner',
        outerCornerClassName: 'rounded-tl-[7px]',
        rotationClassName: '',
        positionClassName: 'col-start-1 row-start-1',
        separatorClassName: 'border-b border-r border-glass-border',
        columnOffset: -1,
        rowOffset: 1,
    },
    {
        direction: 'north',
        kind: 'cardinal',
        icon: 'chevronUp',
        positionClassName: 'col-start-2 row-start-1',
        separatorClassName: 'border-b border-r border-glass-border',
        columnOffset: 0,
        rowOffset: 1,
    },
    {
        direction: 'northEast',
        kind: 'corner',
        outerCornerClassName: 'rounded-tr-[7px]',
        rotationClassName: 'rotate-90',
        positionClassName: 'col-start-3 row-start-1',
        separatorClassName: 'border-b border-glass-border',
        columnOffset: 1,
        rowOffset: 1,
    },
    {
        direction: 'west',
        kind: 'cardinal',
        icon: 'chevronLeft',
        positionClassName: 'col-start-1 row-start-2',
        separatorClassName: 'border-b border-r border-glass-border',
        columnOffset: -1,
        rowOffset: 0,
    },
    {
        direction: 'east',
        kind: 'cardinal',
        icon: 'chevronRight',
        positionClassName: 'col-start-3 row-start-2',
        separatorClassName: 'border-b border-glass-border',
        columnOffset: 1,
        rowOffset: 0,
    },
    {
        direction: 'southWest',
        kind: 'corner',
        outerCornerClassName: 'rounded-bl-[7px]',
        rotationClassName: '-rotate-90',
        positionClassName: 'col-start-1 row-start-3',
        separatorClassName: 'border-r border-glass-border',
        columnOffset: -1,
        rowOffset: -1,
    },
    {
        direction: 'south',
        kind: 'cardinal',
        icon: 'chevronDown',
        positionClassName: 'col-start-2 row-start-3',
        separatorClassName: 'border-r border-glass-border',
        columnOffset: 0,
        rowOffset: -1,
    },
    {
        direction: 'southEast',
        kind: 'corner',
        outerCornerClassName: 'rounded-br-[7px]',
        rotationClassName: 'rotate-180',
        positionClassName: 'col-start-3 row-start-3',
        separatorClassName: '',
        columnOffset: 1,
        rowOffset: -1,
    },
];

function getAdjacentId(cellId: string, columnOffset: number, rowOffset: number) {
    const [column, row] = cellId.replaceAll('_', '/').split('/').map(Number);
    if (!Number.isInteger(column) || !Number.isInteger(row)) return null;

    return `${column + columnOffset}/${row + rowOffset}`;
}

const keyClassName =
    'flex h-full w-full items-center justify-center bg-glass-bg shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]';

const enabledButtonClassName = `${keyClassName} group/sector-arrow text-white/80 transition-[color,background-color,box-shadow] duration-150 hover:bg-neon-amber/[0.12] hover:text-neon-amber hover:shadow-[inset_0_0_0_1px_rgba(255,184,0,0.42),inset_0_1px_0_rgba(255,255,255,0.09)] focus-visible:z-10 focus-visible:bg-neon-amber/[0.12] focus-visible:text-neon-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-amber/60 active:bg-neon-amber/[0.18]`;

const enabledIconClassName =
    'transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/sector-arrow:scale-110 group-focus-visible/sector-arrow:scale-110 motion-reduce:transition-none motion-reduce:transform-none';

const disabledButtonClassName = `${keyClassName} theme-sector-arrow-disabled cursor-not-allowed text-white/20 opacity-55`;

function DirectionGlyph({ config, animated }: { config: DirectionConfig; animated: boolean }) {
    const animationClassName = animated ? enabledIconClassName : '';

    if (config.kind === 'cardinal') {
        return <Icon name={config.icon} size={18} strokeWidth={2} className={animationClassName} />;
    }

    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className={`h-3.5 w-3.5 ${config.rotationClassName} ${animationClassName}`}
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
        >
            <path d="M17 7H7v10" />
        </svg>
    );
}

export function SectorNavigation({ cellId, onNavigate, onRecenter }: SectorNavigationProps) {
    const { t } = useTranslation();
    const navigationRef = useRef<HTMLDivElement>(null);

    return (
        <GlassPanel
            ref={navigationRef}
            data-testid="sector-navigation"
            className="grid h-[76px] w-[76px] shrink-0 grid-cols-[0.92fr_1.16fr_0.92fr] grid-rows-[0.92fr_1.16fr_0.92fr] gap-0 overflow-hidden !p-0"
            aria-label={t('sectorNavigation.label')}
            role="group"
        >
            <button
                type="button"
                data-testid="viewer-recenter"
                aria-label={t('viewer.recenter')}
                title={t('viewer.recenter')}
                onClick={onRecenter}
                className="group/sector-center col-start-2 row-start-2 flex h-full w-full items-center justify-center border-b border-r border-glass-border bg-black/35 shadow-[inset_0_1px_5px_rgba(0,0,0,0.7)] transition-colors hover:bg-neon-amber/[0.12] focus-visible:z-10 focus-visible:bg-neon-amber/[0.12] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-neon-amber/60 active:bg-neon-amber/[0.18]"
            >
                <span className="h-2 w-2 rounded-full bg-neon-amber shadow-[0_0_8px_rgba(255,184,0,0.62)] transition-transform group-hover/sector-center:scale-125 group-focus-visible/sector-center:scale-125 motion-reduce:transition-none" />
            </button>

            {directions.map((config) => {
                const adjacentId = getAdjacentId(cellId, config.columnOffset, config.rowOffset);
                const sector = adjacentId ? sectors.get(adjacentId) : undefined;

                if (!sector) {
                    return (
                        <button
                            key={config.direction}
                            type="button"
                            className={`${disabledButtonClassName} ${config.positionClassName} ${config.separatorClassName} ${config.outerCornerClassName ?? ''}`}
                            disabled
                            aria-label={t('sectorNavigation.unavailable')}
                        >
                            <DirectionGlyph config={config} animated={false} />
                        </button>
                    );
                }

                return (
                    <Popover
                        key={config.direction}
                        align="center"
                        anchorRef={navigationRef}
                        className="theme-surface rounded-lg border border-white/10 bg-void-black/90 px-3 py-2.5 text-center text-[13px] leading-snug text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]"
                        onTriggerClick={() => onNavigate(sector)}
                        role="tooltip"
                        side="top"
                        trigger={<DirectionGlyph config={config} animated />}
                        triggerAriaLabel={t('sectorNavigation.navigate', {
                            id: sector.id,
                            name: sector.name ?? t('sectorNavigation.unnamed'),
                        })}
                        triggerClassName={`${enabledButtonClassName} ${config.positionClassName} ${config.separatorClassName} ${config.outerCornerClassName ?? ''}`}
                        width={190}
                    >
                        <div className="font-medium text-neon-amber">
                            {sector.name ?? t('sectorNavigation.unnamed')}
                        </div>
                        <div className="mt-0.5 font-mono text-xs text-white/55">{sector.id}</div>
                    </Popover>
                );
            })}
        </GlassPanel>
    );
}
