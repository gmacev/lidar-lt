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
        <button
            data-testid="viewer-mobile-notice"
            type="button"
            onClick={() => setIsDismissed(true)}
            title={t('viewer.mobileNoticeDismiss')}
            className="fixed left-2 right-14 top-14 z-40 mx-auto max-w-[300px] cursor-pointer rounded-lg border border-amber-400/30 bg-black/70 p-2 text-left backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
            <span className="flex items-start gap-1.5">
                <Icon name="warningTriangle" size={18} className="mt-px shrink-0 text-amber-300" />
                <span className="min-w-0 flex-1 text-[13px] font-bold leading-tight text-amber-200">
                    {t('viewer.mobileNoticeTitle')}
                </span>
                <span
                    data-testid="viewer-mobile-notice-close"
                    aria-hidden="true"
                    className="-mr-1 -mt-1 shrink-0 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <Icon name="close" size={14} />
                </span>
            </span>
            <span className="mt-1 block text-xs leading-snug text-white/65">
                {t('viewer.mobileNoticeBody')}
            </span>
            <span className="sr-only">{t('viewer.mobileNoticeDismiss')}</span>
        </button>
    );
}
