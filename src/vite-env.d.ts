interface ImportMetaEnv {
    readonly VITE_EPT_BASE_URL: string;
    readonly VITE_GRID_DATA_URL: string;
    readonly VITE_ENABLE_DEV_TOOLS: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
