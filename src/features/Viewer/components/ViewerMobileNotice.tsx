import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Icon } from '@/common/components';
import { isTouchDevice } from '@/common/utils/screenSize';

/**
 * Dismissible warning shown on touch devices: the 3D viewer is built
 * for desktop, so some functionality may not work there.
 * Viewport-pinned below the top button row (top-14 clears the 40px
 * buttons, right-14 clears the right rail) so it can use the full
 * width; hidden once dismissed (per mount).
 */
export function ViewerMobileNotice() {
    const { t } = useTranslation();
    const [isDismissed, setIsDismissed] = useState(false);

    if (!isTouchDevice() || isDismissed) return null;

    return (
        <div
            data-testid="viewer-mobile-notice"
            role="note"
            className="fixed left-2 right-14 top-14 z-40 mx-auto max-w-[300px] rounded-lg border border-amber-400/30 bg-black/70 p-2 backdrop-blur-sm"
        >
            <div className="flex items-start gap-1.5">
                <Icon name="warningTriangle" size={18} className="mt-px shrink-0 text-amber-300" />
                <p className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-amber-200">
                    {t('viewer.mobileNoticeTitle')}
                </p>
                <button
                    data-testid="viewer-mobile-notice-close"
                    type="button"
                    onClick={() => setIsDismissed(true)}
                    aria-label={t('viewer.mobileNoticeDismiss')}
                    title={t('viewer.mobileNoticeDismiss')}
                    className="-mr-1 -mt-1 shrink-0 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <Icon name="close" size={14} />
                </button>
            </div>
            <p className="mt-1 text-xs leading-snug text-white/65">
                {t('viewer.mobileNoticeBody')}
            </p>
        </div>
    );
}
