const POTREE_STYLESHEET = '/potree/potree.css';
const POTREE_DEPENDENCIES = [
    '/libs/three.js/build/three.min.js',
    '/libs/jquery/jquery-3.7.1.min.js',
    '/libs/proj4/proj4.js',
    '/libs/other/BinaryHeap.js',
    '/libs/tween/tween.min.js',
] as const;
const POTREE_SCRIPT = '/potree/potree.js';

let runtimePromise: Promise<void> | undefined;

const loadStylesheet = (href: string) =>
    new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLLinkElement>(
            `link[data-runtime-href="${href}"]`
        );
        if (existing?.dataset.runtimeStatus === 'loaded') {
            resolve();
            return;
        }

        const stylesheet = existing ?? document.createElement('link');
        const handleLoad = () => {
            stylesheet.dataset.runtimeStatus = 'loaded';
            resolve();
        };
        const handleError = () => {
            stylesheet.remove();
            reject(new Error(`Failed to load ${href}`));
        };

        stylesheet.addEventListener('load', handleLoad, { once: true });
        stylesheet.addEventListener('error', handleError, { once: true });

        if (!existing) {
            stylesheet.rel = 'stylesheet';
            stylesheet.href = href;
            stylesheet.dataset.runtimeHref = href;
            stylesheet.dataset.runtimeStatus = 'loading';
            document.head.append(stylesheet);
        }
    });

const loadScript = (src: string) =>
    new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
            `script[data-runtime-src="${src}"]`
        );
        if (existing?.dataset.runtimeStatus === 'loaded') {
            resolve();
            return;
        }

        const script = existing ?? document.createElement('script');
        const handleLoad = () => {
            script.dataset.runtimeStatus = 'loaded';
            resolve();
        };
        const handleError = () => {
            script.remove();
            reject(new Error(`Failed to load ${src}`));
        };

        script.addEventListener('load', handleLoad, { once: true });
        script.addEventListener('error', handleError, { once: true });

        if (!existing) {
            script.src = src;
            script.async = true;
            script.dataset.runtimeSrc = src;
            script.dataset.runtimeStatus = 'loading';
            document.head.append(script);
        }
    });

export const loadPotreeRuntime = () => {
    runtimePromise ??= Promise.all([
        loadStylesheet(POTREE_STYLESHEET),
        ...POTREE_DEPENDENCIES.map(loadScript),
    ])
        .then(() => loadScript(POTREE_SCRIPT))
        .catch((error: unknown) => {
            runtimePromise = undefined;
            throw error;
        });

    return runtimePromise;
};
