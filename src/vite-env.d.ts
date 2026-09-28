interface ImportMetaEnv {
    readonly VITE_EPT_BASE_URL: string;
    readonly VITE_GRID_DATA_URL: string;
    readonly VITE_ENABLE_DEV_TOOLS: string;
}

declare module 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url' {
    const url: string;
    export default url;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
