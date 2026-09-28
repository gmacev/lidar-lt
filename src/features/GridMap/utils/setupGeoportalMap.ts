import { setWorkerUrl } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { registerGeoportalProtocol } from './geoportalTiles';

setWorkerUrl(maplibreWorkerUrl);
registerGeoportalProtocol();
