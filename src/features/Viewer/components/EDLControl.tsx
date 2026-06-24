import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from '@/common/components/Switch';
import { HelpHint, Icon } from '@/common/components';
import type { PotreeViewer } from '@/common/types/potree';
import { EDL_DEFAULTS } from '@/features/Viewer/config';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { useCommittedRange } from '@/features/Viewer/hooks/useCommittedRange';

interface EDLControlProps {
    viewerRef: React.RefObject<PotreeViewer | null>;
    initialState: ViewerState;
    updateUrl: (state: Partial<ViewerState>) => void;
}

export function EDLControl({ viewerRef, initialState, updateUrl }: EDLControlProps) {
    const { t } = useTranslation();
    const [edlEnabled, setEdlEnabled] = useState(initialState.edlEnabled ?? EDL_DEFAULTS.enabled);
    const [edlStrength, setEdlStrength] = useState(
        initialState.edlStrength ?? EDL_DEFAULTS.strength
    );
    const [edlRadius, setEdlRadius] = useState(initialState.edlRadius ?? EDL_DEFAULTS.radius);
    const commitEdlStrength = useCommittedRange(edlStrength, (value) =>
        updateUrl({ edlStrength: value })
    );
    const commitEdlRadius = useCommittedRange(edlRadius, (value) =>
        updateUrl({ edlRadius: value })
    );

    const handleStrengthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setEdlStrength(value);
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setEDLStrength(value);
        }
    };

    const handleRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        setEdlRadius(value);
        const viewer = viewerRef.current;
        if (viewer) {
            viewer.setEDLRadius(value);
        }
    };

    return (
        <div data-testid="viewer-control-edl" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white/90">{t('edl.label')}</span>
                    <HelpHint
                        ariaLabel={t('edl.helpAria')}
                        title={t('edl.helpTitle')}
                        side="right"
                        align="start"
                    >
                        {t('edl.helpDescription')}
                    </HelpHint>
                </div>
                <Switch
                    ariaLabel={t('edl.label')}
                    testId="viewer-edl-enabled"
                    checked={edlEnabled}
                    onChange={(checked) => {
                        setEdlEnabled(checked);
                        const viewer = viewerRef.current;
                        if (viewer) {
                            viewer.setEDLEnabled(checked);
                        }
                        updateUrl({ edlEnabled: checked });
                    }}
                    icon={<Icon name="sun" size={14} strokeWidth={2.5} />}
                />
            </div>

            <div className={`flex flex-col gap-1 ${!edlEnabled ? 'opacity-40' : ''}`}>
                <label className="flex justify-between text-xs text-white/70">
                    <span className="flex items-center gap-1.5">
                        {t('edl.strength')}
                        <HelpHint ariaLabel={t('edl.strengthHelpAria')} title={t('edl.strength')}>
                            {t('edl.strengthHelp')}
                        </HelpHint>
                    </span>
                    <span className="text-laser-green">{edlStrength.toFixed(1)}</span>
                </label>
                <input
                    data-testid="viewer-edl-strength"
                    type="range"
                    min="0.1"
                    max="10"
                    step="0.1"
                    value={edlStrength}
                    onChange={handleStrengthChange}
                    {...commitEdlStrength}
                    disabled={!edlEnabled}
                    className="w-full accent-laser-green disabled:cursor-not-allowed"
                />
            </div>
            <div className={`flex flex-col gap-1 ${!edlEnabled ? 'opacity-40' : ''}`}>
                <label className="flex justify-between text-xs text-white/70">
                    <span className="flex items-center gap-1.5">
                        {t('edl.radius')}
                        <HelpHint ariaLabel={t('edl.radiusHelpAria')} title={t('edl.radius')}>
                            {t('edl.radiusHelp')}
                        </HelpHint>
                    </span>
                    <span className="text-laser-green">{edlRadius.toFixed(1)}</span>
                </label>
                <input
                    data-testid="viewer-edl-radius"
                    type="range"
                    min="0.5"
                    max="10"
                    step="0.1"
                    value={edlRadius}
                    onChange={handleRadiusChange}
                    {...commitEdlRadius}
                    disabled={!edlEnabled}
                    className="w-full accent-laser-green disabled:cursor-not-allowed"
                />
            </div>
        </div>
    );
}
