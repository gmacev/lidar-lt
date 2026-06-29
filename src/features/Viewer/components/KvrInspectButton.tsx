import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon, NeonButton } from '@/common/components';
import {
    getKvrMatchKey,
    KVR_MATCH_ORDER,
    type KvrMatch,
    type KvrMatchType,
} from '@/features/Viewer/utils/kvrClient';
import type {
    KvrInspectState,
    KvrMatchFocusRequest,
} from '@/features/Viewer/hooks/useKvrInspectTool';
import { ToolPopover } from './ToolPopover';
import { ToolbarToolButton } from './ToolbarToolButton';

interface KvrInspectButtonProps {
    focusRequest: KvrMatchFocusRequest | null;
    inspectState: KvrInspectState;
    isActive: boolean;
    isPopoverOpen: boolean;
    onClick: () => void;
    onClose: () => void;
    onCenterMatch: (match: KvrMatch) => void;
    onRetry: () => void;
}

function groupMatches(matches: KvrMatch[]) {
    return KVR_MATCH_ORDER.map((matchType) => ({
        matchType,
        matches: matches.filter((match) => match.matchType === matchType),
    })).filter((group) => group.matches.length > 0);
}

function formatCoordinate(value: number) {
    return value.toFixed(3);
}

function getMatchTypeLabelKey(matchType: KvrMatchType, count: number) {
    return `kvrInspect.${count === 1 ? 'matchType' : 'matchTypePlural'}.${matchType}`;
}

function capitalizeDisplayText(value: string) {
    if (!value) return '';
    return value.charAt(0).toLocaleUpperCase('lt-LT') + value.slice(1);
}

export function KvrInspectButton({
    focusRequest,
    inspectState,
    isActive,
    isPopoverOpen,
    onClick,
    onClose,
    onCenterMatch,
    onRetry,
}: KvrInspectButtonProps) {
    const { t } = useTranslation();
    const buttonRef = useRef<HTMLButtonElement>(null);
    const matchRefs = useRef(new Map<string, HTMLAnchorElement>());
    const groupedMatches = groupMatches(inspectState.matches);
    const coordinate = inspectState.coordinate;
    const isLoading = inspectState.status === 'loading';

    useEffect(() => {
        if (!focusRequest || !isPopoverOpen) return;

        const frameId = requestAnimationFrame(() => {
            const matchElement = matchRefs.current.get(focusRequest.key);
            if (!matchElement) return;
            matchElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            matchElement.focus({ preventScroll: true });
        });

        return () => cancelAnimationFrame(frameId);
    }, [focusRequest, isPopoverOpen]);

    return (
        <>
            <ToolbarToolButton
                ref={buttonRef}
                data-testid="viewer-tool-kvr"
                icon={<Icon name="question" size={24} />}
                isActive={isActive || isPopoverOpen}
                label={isActive ? t('kvrInspect.activeLabel') : t('kvrInspect.label')}
                onClick={onClick}
            />

            <ToolPopover
                anchorRef={buttonRef}
                isOpen={isPopoverOpen}
                testId="viewer-kvr-popover"
                width={360}
                className="flex max-h-[500px] flex-col overflow-hidden rounded-lg border border-white/10 bg-black/95 p-4 pr-3 text-white shadow-2xl shadow-black/40"
            >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 pb-1.5">
                    <div>
                        <h3 className="text-sm font-bold text-neon-amber">
                            Kultūros vertybių registras
                        </h3>
                        {coordinate && (
                            <p className="mt-1 font-mono text-[11px] text-white/45">
                                {formatCoordinate(coordinate.x)}, {formatCoordinate(coordinate.y)}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        aria-label={t('kvrInspect.close')}
                        className="flex size-7 shrink-0 items-center justify-center rounded-md border border-white/10 text-white/60 transition hover:border-neon-amber/50 hover:text-neon-amber"
                        onClick={onClose}
                    >
                        <Icon name="close" size={16} />
                    </button>
                </div>

                <div
                    data-testid="viewer-kvr-results-scroll"
                    className="min-h-0 overflow-y-auto pr-1 pt-3"
                >
                    {isLoading && (
                        <div className="flex items-center gap-3 rounded-md border border-white/10 bg-white/[0.04] p-3">
                            <div className="size-5 animate-spin rounded-full border-2 border-white/15 border-t-neon-amber" />
                            <p className="text-sm leading-5 text-white/75">
                                {t('kvrInspect.loading')}
                            </p>
                        </div>
                    )}

                    {inspectState.status === 'success' && (
                        <div className="flex flex-col gap-3.5">
                            {groupedMatches.map((group) => (
                                <section key={group.matchType} className="flex flex-col gap-2">
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-white/45">
                                        {t(
                                            getMatchTypeLabelKey(
                                                group.matchType,
                                                group.matches.length
                                            )
                                        )}
                                    </h4>
                                    <div className="flex flex-col gap-2.5">
                                        {group.matches.map((match) => {
                                            const matchKey = getKvrMatchKey(match);
                                            const isHighlighted = focusRequest?.key === matchKey;

                                            return (
                                                <div key={matchKey} className="relative">
                                                    <a
                                                        ref={(element) => {
                                                            if (element)
                                                                matchRefs.current.set(
                                                                    matchKey,
                                                                    element
                                                                );
                                                            else matchRefs.current.delete(matchKey);
                                                        }}
                                                        data-kvr-match-key={matchKey}
                                                        data-highlighted={
                                                            isHighlighted ? 'true' : 'false'
                                                        }
                                                        href={match.detailUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        aria-label={`${t('kvrInspect.openKvr')}: ${
                                                            match.name || t('kvrInspect.unnamed')
                                                        }`}
                                                        className={`block cursor-pointer rounded-md border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/40 ${
                                                            isHighlighted
                                                                ? 'border-neon-amber bg-neon-amber/[0.12] shadow-[0_0_0_1px_rgba(255,191,0,0.28),0_0_14px_rgba(255,191,0,0.12)]'
                                                                : 'border-white/10 bg-white/[0.04] hover:border-neon-amber/45 hover:bg-neon-amber/[0.06] focus-visible:border-neon-amber'
                                                        }`}
                                                    >
                                                        <h5 className="pr-10 text-sm font-semibold leading-[1.35] text-white">
                                                            {match.name || t('kvrInspect.unnamed')}
                                                        </h5>

                                                        <p className="mt-1.5 text-xs leading-4 text-white/55">
                                                            {[
                                                                match.code &&
                                                                    t('kvrInspect.code', {
                                                                        code: match.code,
                                                                    }),
                                                                capitalizeDisplayText(
                                                                    match.objectName
                                                                ),
                                                                match.status,
                                                            ]
                                                                .filter(Boolean)
                                                                .join(' · ')}
                                                        </p>

                                                        {match.address && (
                                                            <p className="mt-1 text-xs leading-4 text-white/65">
                                                                {match.address}
                                                            </p>
                                                        )}

                                                        {(match.shapeType ||
                                                            match.area !== undefined) && (
                                                            <p className="mt-1 text-xs leading-4 text-white/45">
                                                                {[
                                                                    match.shapeType,
                                                                    formatArea(match.area),
                                                                ]
                                                                    .filter(Boolean)
                                                                    .join(' · ')}
                                                            </p>
                                                        )}
                                                    </a>

                                                    {match.center && (
                                                        <button
                                                            type="button"
                                                            aria-label={t(
                                                                'kvrInspect.centerObject'
                                                            )}
                                                            className="absolute right-0 top-0 flex size-8 items-center justify-center rounded-bl-md rounded-tr-md border-b border-l border-white/10 bg-black/55 text-white/60 transition hover:border-neon-amber/50 hover:bg-neon-amber/10 hover:text-neon-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neon-amber/50"
                                                            onClick={(event) => {
                                                                event.preventDefault();
                                                                event.stopPropagation();
                                                                onCenterMatch(match);
                                                            }}
                                                        >
                                                            <Icon name="crosshair" size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}

                    {inspectState.status === 'empty' && (
                        <div className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                            <p className="text-sm font-semibold leading-5 text-white">
                                {t('kvrInspect.emptyTitle')}
                            </p>
                            <p className="mt-3 text-sm leading-5 text-white/65">
                                {t('kvrInspect.emptyDescription')}
                            </p>
                        </div>
                    )}

                    {inspectState.status === 'error' && (
                        <div className="flex flex-col gap-3 rounded-md border border-plasma-red/30 bg-plasma-red/10 p-3">
                            <div>
                                <p className="text-sm font-semibold leading-5 text-white">
                                    {t('kvrInspect.errorTitle')}
                                </p>
                                <p className="mt-3 text-sm leading-5 text-white/65">
                                    {inspectState.error ?? t('kvrInspect.errorDescription')}
                                </p>
                            </div>
                            {coordinate && (
                                <NeonButton
                                    variant="amber"
                                    className="px-3 py-1.5"
                                    onClick={onRetry}
                                >
                                    {t('kvrInspect.retry')}
                                </NeonButton>
                            )}
                        </div>
                    )}

                    {inspectState.status === 'idle' && (
                        <p className="text-sm leading-5 text-white/65">
                            {t('kvrInspect.readyDescription')}
                        </p>
                    )}
                </div>
            </ToolPopover>
        </>
    );
}

function formatArea(area?: number) {
    if (area === undefined) return '';
    return `${Math.round(area).toLocaleString()} m²`;
}
