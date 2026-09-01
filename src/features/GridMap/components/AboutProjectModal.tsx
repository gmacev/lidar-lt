import { useTranslation } from 'react-i18next';

const externalLinkClassName =
    'text-neon-amber underline-offset-2 transition-colors hover:underline focus-visible:underline focus-visible:outline-none';

export function AboutProjectModal() {
    const { t } = useTranslation();

    return (
        <div className="flex flex-col gap-5 p-5 text-sm leading-6 text-white/75 sm:p-6">
            <p>{t('home.about.description')}</p>

            <p>
                {t('home.about.originPrefix')}
                <a
                    href="https://www.geoportal.lt/"
                    target="_blank"
                    rel="noreferrer"
                    className={externalLinkClassName}
                >
                    geoportal.lt
                </a>
                {t('home.about.originSuffix')}
            </p>

            <p>{t('home.about.dataResponsibility')}</p>

            <p>{t('home.about.hosting')}</p>

            <dl className="grid gap-x-3 gap-y-1 border-t border-white/10 pt-5 sm:grid-cols-[auto_1fr]">
                <dt className="font-semibold text-white/90">{t('home.about.authorLabel')}</dt>
                <dd>
                    Giedrius Macevičius ·{' '}
                    <a
                        href="https://www.linkedin.com/in/gmacev/"
                        target="_blank"
                        rel="noreferrer"
                        className={externalLinkClassName}
                    >
                        LinkedIn
                    </a>
                </dd>

                <dt className="font-semibold text-white/90">{t('home.about.projectCodeLabel')}</dt>
                <dd>
                    <a
                        href="https://github.com/gmacev/lidar-lt"
                        target="_blank"
                        rel="noreferrer"
                        className={externalLinkClassName}
                    >
                        GitHub
                    </a>
                </dd>
            </dl>
        </div>
    );
}
