const GEOPORTAL_BASE_URL = 'https://www.geoportal.lt';
export const GEOPORTAL_HOME_URL = `${GEOPORTAL_BASE_URL}/`;
export const GEOPORTAL_PLACE_NAMES_URL = `${GEOPORTAL_BASE_URL}/vietovardziai/`;

export const GEOPORTAL_KVR_MAP_SERVER_URL = `${GEOPORTAL_BASE_URL}/mapproxy/rest/services/kpd_kvr/MapServer`;
export const GEOPORTAL_MAP_LABEL_SEARCH_URL = `${GEOPORTAL_BASE_URL}/mapproxy/elasticsearch_gvdr`;
export const GEOPORTAL_GRID_TILE_ROOT_URL = `${GEOPORTAL_BASE_URL}/mapproxy/rest/services/gisc_pagrindinis_wm/MapServer/tile`;

export const GEOPORTAL_ORTHOPHOTO_CATALOG_URL = `${GEOPORTAL_BASE_URL}/arcgis/rest/services/NZT?f=pjson`;

export const GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT = `${GEOPORTAL_BASE_URL}/mapproxy`;
const GEOPORTAL_ORTHOPHOTO_ALIASES: Readonly<Record<string, string>> = {
    'NZT/ORT_recent': 'nzt_ort10lt_recent',
    'NZT/ORT10LT_2015': 'nzt_ort10lt_2015_2017',
};

/** Resolves an ArcGIS catalog service name to its public Geoportal MapProxy endpoint. */
export function getGeoportalOrthophotoMapServerUrl(serviceName: string) {
    const alias = GEOPORTAL_ORTHOPHOTO_ALIASES[serviceName];
    if (alias) return `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/${alias}/MapServer`;

    const match = /^NZT\/(ORT10LT_\d{4}(?:_\d{4})?)$/.exec(serviceName);
    if (!match) throw new Error(`Unsupported Geoportal orthophoto service: ${serviceName}`);

    return `${GEOPORTAL_ORTHOPHOTO_MAP_PROXY_ROOT}/nzt_${match[1].toLowerCase()}/MapServer`;
}
