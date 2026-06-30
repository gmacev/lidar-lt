import { useState, useSyncExternalStore, type ChangeEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/common/components/Switch';
import { HelpHint, Icon } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { RELIEF_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';
import type { ReliefAzimuthCycleController } from '@/features/Viewer/hooks/useReliefAzimuthCycle';

interface ReliefControlProps {
    viewerRef: RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    azimuthCycle: ReliefAzimuthCycleController;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function ReliefControl({
    viewerRef,
    initialState,
    azimuthCycle,
    updateUrl,
}: ReliefControlProps) {
    const { t } = useTranslation();
    const azimuthCycleState = useSyncExternalStore(
        azimuthCycle.subscribe,
        azimuthCycle.getSnapshot,
        azimuthCycle.getSnapshot
    );
    const [reliefEnabled, setReliefEnabled] = useState(
        initialState.reliefEnabled ?? RELIEF_DEFAULTS.enabled
    );
    const [reliefStrength, setReliefStrength] = useState(
        initialState.reliefStrength ?? RELIEF_DEFAULTS.strength
    );
    const commitReliefStrength = useCommittedRange(reliefStrength, (value) =>
        updateUrl({ reliefStrength: value })
    );
    const commitReliefAzimuth = useCommittedRange(azimuthCycleState.azimuth, (value) =>
        updateUrl({ reliefAzimuth: value })
    );

    const handleStrengthChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setReliefStrength(value);
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setReliefStrength(value);
        }
    };

    const handleAzimuthChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        azimuthCycle.setAzimuthManually(value);
    };

    const cycleLabel =
        azimuthCycleState.duration === null
            ? t('relief.azimuthCycleOff')
            : t('relief.azimuthCycleSeconds', { seconds: azimuthCycleState.duration });

    return (
        <div data-testid="viewer-control-relief" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white/90">{t('relief.label')}</span>
                    <HelpHint
                        ariaLabel={t('relief.helpAria')}
                        title={t('relief.helpTitle')}
                        side="right"
                        align="start"
                    >
                        {t('relief.helpDescription')}
                    </HelpHint>
                </div>
                <Switch
                    ariaLabel={t('relief.label')}
                    testId="viewer-relief-enabled"
                    checked={reliefEnabled}
                    onChange={(checked) => {
                        azimuthCycle.setReliefEnabled(checked);
                        setReliefEnabled(checked);
                        const viewer = viewerRef.current;
                        if (viewer) {
                            viewer.setReliefEnabled(checked);
                        }
                        updateUrl({ reliefEnabled: checked });
                    }}
                    icon={<Icon name="activity" size={14} strokeWidth={2.5} />}
                />
            </div>

            <div className={`flex flex-col gap-1 ${!reliefEnabled ? 'opacity-40' : ''}`}>
                <label className="flex justify-between text-xs text-white/70">
                    <span className="flex items-center gap-1.5">
                        {t('relief.strength')}
                        <HelpHint
                            ariaLabel={t('relief.strengthHelpAria')}
                            title={t('relief.strength')}
                        >
                            {t('relief.strengthHelp')}
                        </HelpHint>
                    </span>
                    <span className="text-laser-green">{reliefStrength.toFixed(1)}</span>
                </label>
                <input
                    data-testid="viewer-relief-strength"
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={reliefStrength}
                    onChange={handleStrengthChange}
                    {...commitReliefStrength}
                    disabled={!reliefEnabled}
                    className="w-full accent-laser-green disabled:cursor-not-allowed"
                />
            </div>

            <div className={`flex flex-col gap-1 ${!reliefEnabled ? 'opacity-40' : ''}`}>
                <div className="flex items-center justify-between text-xs text-white/70">
                    <span className="flex items-center gap-1.5">
                        {t('relief.azimuth')}
                        <HelpHint
                            ariaLabel={t('relief.azimuthHelpAria')}
                            title={t('relief.azimuth')}
                        >
                            {t('relief.azimuthHelp')}
                        </HelpHint>
                    </span>
                    <span className="flex items-center gap-2">
                        <button
                            type="button"
                            data-testid="viewer-relief-azimuth-cycle"
                            disabled={!reliefEnabled}
                            onClick={azimuthCycle.advance}
                            aria-label={t('relief.azimuthCycleAria', { mode: cycleLabel })}
                            aria-pressed={azimuthCycleState.duration !== null}
                            title={t('relief.azimuthCycleTitle')}
                            className={`inline-flex h-6 min-w-14 items-center justify-center gap-1 rounded border px-1.5 font-mono text-[10px] font-bold tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                                azimuthCycleState.duration === null
                                    ? 'border-white/15 bg-white/5 text-white/55 hover:border-white/30 hover:text-white/80'
                                    : 'border-laser-green/50 bg-laser-green/10 text-laser-green hover:bg-laser-green/15'
                            }`}
                        >
                            <svg
                                aria-hidden="true"
                                viewBox="0 0 16 16"
                                className={`h-3 w-3 ${azimuthCycleState.duration !== null ? 'animate-spin' : ''}`}
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            >
                                <path d="M13.25 5.5A5.75 5.75 0 1 0 13 11" />
                                <path d="M10.5 5.5h2.75V2.75" />
                            </svg>
                            {cycleLabel}
                        </button>
                        <span className="min-w-8 text-right text-laser-green">
                            {Math.round(azimuthCycleState.azimuth)}&deg;
                        </span>
                    </span>
                </div>
                <input
                    data-testid="viewer-relief-azimuth"
                    aria-label={t('relief.azimuth')}
                    type="range"
                    min="0"
                    max="359"
                    step="1"
                    value={azimuthCycleState.azimuth}
                    onChange={handleAzimuthChange}
                    {...commitReliefAzimuth}
                    disabled={!reliefEnabled}
                    className="w-full accent-laser-green disabled:cursor-not-allowed"
                />
                <div className="flex justify-between text-[10px] text-white/45">
                    <span>N</span>
                    <span>E</span>
                    <span>S</span>
                    <span>W</span>
                    <span>N</span>
                </div>
            </div>
        </div>
    );
}
