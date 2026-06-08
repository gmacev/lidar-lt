import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import gridData from '@/assets/grid.json';
import { GlassPanel, Icon, Popover, type IconName } from '@/common/components';

type Direction =
    | 'north'
    | 'northEast'
    | 'east'
    | 'southEast'
    | 'south'
    | 'southWest'
    | 'west'
    | 'northWest';

interface Sector {
    id: string;
    name: string | null;
}

interface SectorNavigationProps {
    cellId: string;
    onNavigate: (sector: Sector) => void;
}

interface DirectionConfig {
    columnOffset: number;
    direction: Direction;
    icon: IconName;
    iconClassName?: string;
    positionClassName: string;
    rowOffset: number;
}

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
        icon: 'chevronUp',
        iconClassName: '-rotate-45',
        positionClassName: 'col-start-1 row-start-1',
        columnOffset: -1,
        rowOffset: 1,
    },
    {
        direction: 'north',
        icon: 'chevronUp',
        positionClassName: 'col-start-2 row-start-1',
        columnOffset: 0,
        rowOffset: 1,
    },
    {
        direction: 'northEast',
        icon: 'chevronUp',
        iconClassName: 'rotate-45',
        positionClassName: 'col-start-3 row-start-1',
        columnOffset: 1,
        rowOffset: 1,
    },
    {
        direction: 'west',
        icon: 'chevronLeft',
        positionClassName: 'col-start-1 row-start-2',
        columnOffset: -1,
        rowOffset: 0,
    },
    {
        direction: 'east',
        icon: 'chevronRight',
        positionClassName: 'col-start-3 row-start-2',
        columnOffset: 1,
        rowOffset: 0,
    },
    {
        direction: 'southWest',
        icon: 'chevronUp',
        iconClassName: '-rotate-[135deg]',
        positionClassName: 'col-start-1 row-start-3',
        columnOffset: -1,
        rowOffset: -1,
    },
    {
        direction: 'south',
        icon: 'chevronDown',
        positionClassName: 'col-start-2 row-start-3',
        columnOffset: 0,
        rowOffset: -1,
    },
    {
        direction: 'southEast',
        icon: 'chevronUp',
        iconClassName: 'rotate-[135deg]',
        positionClassName: 'col-start-3 row-start-3',
        columnOffset: 1,
        rowOffset: -1,
    },
];

function getAdjacentId(cellId: string, columnOffset: number, rowOffset: number) {
    const [column, row] = cellId.replaceAll('_', '/').split('/').map(Number);
    if (!Number.isInteger(column) || !Number.isInteger(row)) return null;

    return `${column + columnOffset}/${row + rowOffset}`;
}

const enabledButtonClassName =
    'group/sector-arrow flex h-5 w-5 items-center justify-center text-white/75 transition-colors duration-150 hover:text-neon-amber focus-visible:text-neon-amber focus-visible:outline-none active:text-neon-amber';

const enabledIconClassName =
    'transition-transform duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover/sector-arrow:scale-125 group-focus-visible/sector-arrow:scale-125 group-active/sector-arrow:scale-110 motion-reduce:transition-none motion-reduce:transform-none';

const disabledButtonClassName =
    'flex h-5 w-5 cursor-not-allowed items-center justify-center text-white/20';

export function SectorNavigation({ cellId, onNavigate }: SectorNavigationProps) {
    const { t } = useTranslation();
    const navigationRef = useRef<HTMLDivElement>(null);

    return (
        <GlassPanel
            ref={navigationRef}
            className="grid h-[72px] w-[72px] shrink-0 grid-cols-[18px_1fr_18px] grid-rows-[18px_1fr_18px] place-items-center !rounded-lg !p-1"
            aria-label={t('sectorNavigation.label')}
            role="group"
        >
            <span
                className="col-start-2 row-start-2 h-1.5 w-1.5 rounded-full bg-neon-amber"
                aria-hidden="true"
            />

            {directions.map(
                ({
                    columnOffset,
                    direction,
                    icon,
                    iconClassName: directionIconClassName = '',
                    positionClassName,
                    rowOffset,
                }) => {
                    const adjacentId = getAdjacentId(cellId, columnOffset, rowOffset);
                    const sector = adjacentId ? sectors.get(adjacentId) : undefined;
                    const enabledResolvedIconClassName = `${enabledIconClassName} ${directionIconClassName}`;

                    if (!sector) {
                        return (
                            <button
                                key={direction}
                                type="button"
                                className={`${disabledButtonClassName} ${positionClassName}`}
                                disabled
                                aria-label={t('sectorNavigation.unavailable')}
                            >
                                <Icon
                                    name={icon}
                                    size={17}
                                    strokeWidth={1.8}
                                    className={directionIconClassName}
                                />
                            </button>
                        );
                    }

                    return (
                        <Popover
                            key={direction}
                            align="center"
                            anchorRef={navigationRef}
                            className="rounded-lg border border-white/10 bg-void-black/90 px-3 py-2.5 text-center text-[13px] leading-snug text-white/75 shadow-[0_18px_50px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.08)]"
                            onTriggerClick={() => onNavigate(sector)}
                            role="tooltip"
                            side="top"
                            trigger={
                                <Icon
                                    name={icon}
                                    size={17}
                                    strokeWidth={1.8}
                                    className={enabledResolvedIconClassName}
                                />
                            }
                            triggerAriaLabel={t('sectorNavigation.navigate', {
                                id: sector.id,
                                name: sector.name ?? t('sectorNavigation.unnamed'),
                            })}
                            triggerClassName={`${enabledButtonClassName} ${positionClassName}`}
                            width={190}
                        >
                            <div className="font-medium text-neon-amber">
                                {sector.name ?? t('sectorNavigation.unnamed')}
                            </div>
                            <div className="mt-0.5 font-mono text-xs text-white/55">
                                {sector.id}
                            </div>
                        </Popover>
                    );
                }
            )}
        </GlassPanel>
    );
}
