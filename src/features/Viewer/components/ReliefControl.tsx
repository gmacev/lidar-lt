import { useState, type ChangeEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/common/components/Switch';
import { HelpHint, Icon } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { RELIEF_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

interface ReliefControlProps {
    viewerRef: RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function ReliefControl({ viewerRef, initialState, updateUrl }: ReliefControlProps) {
    const { t } = useTranslation();
    const [reliefEnabled, setReliefEnabled] = useState(
        initialState.reliefEnabled ?? RELIEF_DEFAULTS.enabled
    );
    const [reliefStrength, setReliefStrength] = useState(
        initialState.reliefStrength ?? RELIEF_DEFAULTS.strength
    );
    const commitReliefStrength = useCommittedRange(reliefStrength, (value) =>
        updateUrl({ reliefStrength: value })
    );

    const handleStrengthChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setReliefStrength(value);
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setReliefStrength(value);
        }
    };

    return (
        <div className="flex flex-col gap-3">
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
                    checked={reliefEnabled}
                    onChange={(checked) => {
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
        </div>
    );
}
