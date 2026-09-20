const GEOPORTAL_BASE_URL = 'https://www.geoportal.lt';
export const GEOPORTAL_HOME_URL = `${GEOPORTAL_BASE_URL}/`;
export const GEOPORTAL_PLACE_NAMES_URL = `${GEOPORTAL_BASE_URL}/vietovardziai/`;

export const GEOPORTAL_KVR_MAP_SERVER_URL = `${GEOPORTAL_BASE_URL}/mapproxy/rest/services/kpd_kvr/MapServer`;
export const GEOPORTAL_MAP_LABEL_SEARCH_URL = `${GEOPORTAL_BASE_URL}/mapproxy/elasticsearch_gvdr`;
export const GEOPORTAL_GRID_TILE_ROOT_URL = `${GEOPORTAL_BASE_URL}/mapproxy/rest/services/gisc_pagrindinis_wm/MapServer/tile`;

export const GEOPORTAL_ORTHOPHOTO_DISCOVERY_URL = `${GEOPORTAL_BASE_URL}/TreeApi/api/Service/search/Ortofoto`;
export const GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT = `${GEOPORTAL_BASE_URL}/mapproxy`;

export interface GeoportalOrthophotoEndpoint {
    key: string;
    url: string;
}

/** Last-known-good MapProxy services used only when TreeApi discovery is unavailable. */
export const GEOPORTAL_ORTHOPHOTO_FALLBACK_ENDPOINTS: readonly GeoportalOrthophotoEndpoint[] = [
    {
        key: 'nzt_ort10lt_recent',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_recent/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2024_2026',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2024_2026/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2021_2023',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2021_2023/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2018_2020',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2018_2020/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2015_2017',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2015_2017/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2012_2013',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2012_2013/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2009_2010',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2009_2010/MapServer`,
    },
    {
        key: 'nzt_ort10lt_2005_2006',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_2005_2006/MapServer`,
    },
    {
        key: 'nzt_ort10lt_1995_2001',
        url: `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_ort10lt_1995_2001/MapServer`,
    },
];
