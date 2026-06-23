export const EPT_BASE_URL = import.meta.env.VITE_EPT_BASE_URL;

export function getViewerDataUrl(cellId: string) {
    return `${EPT_BASE_URL}/${cellId}/potree_output/metadata.json`;
}

export function getViewerSourceManifestUrl(cellId: string) {
    return `${EPT_BASE_URL}/${cellId}/potree_output/source_manifest.json`;
}
