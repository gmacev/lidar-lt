import { expect, type Page } from '@playwright/test';

export const CANONICAL_CELL_ID = '76_32';
const CANONICAL_SECTOR_NAME = 'VILNIUS (centras)';
const VIEWER_READY_TIMEOUT_MS = 10_000;
export const CANONICAL_VIEWER_PATH = `/viewer/${CANONICAL_CELL_ID}?sectorName=${encodeURIComponent(
    CANONICAL_SECTOR_NAME
)}`;

const MOCK_METADATA = {
    version: '2.0',
    name: 'mock-cloud',
    points: 1000,
    projection: '',
    boundingBox: {
        min: [581000, 6060000, 86],
        max: [582000, 6061000, 226],
    },
    attributes: [
        {
            name: 'position',
            min: [581000, 6060000, 86],
            max: [582000, 6061000, 226],
            range: [
                [581000, 6060000, 86],
                [582000, 6061000, 226],
            ],
        },
    ],
};

const MOCK_SOURCE_MANIFEST = {
    sourceFileDateRange: {
        from: '2025',
        to: '2025',
    },
};

const MOCK_KVR_NAME =
    'Gedimino kalno, pilies bokšto ir Aukštutinės pilies pastatų komplekso liekanos';

function getMockKvrAttributes(
    objectId: number,
    code: string,
    name: string,
    additionalAttributes: Record<string, string> = {}
) {
    return {
        OBJECTID: objectId,
        Unikalus_kodas: code,
        Pavadinimas: name,
        Statusas: 'Registrinis',
        URL: `http://kvr.kpd.lt/heritage/Pages/KVRDetail.aspx?lang=lt&MC=${code}`,
        ...additionalAttributes,
    };
}

function getMockKvrResponse(url: string) {
    const { pathname } = new URL(url);
    const pathMatch = pathname.match(/\/MapServer\/(\d+)(?:\/(\d+))?(?:\/query)?$/);
    const layerId = Number(pathMatch?.[1]);
    const featureId = pathMatch?.[2] ? Number(pathMatch[2]) : null;

    if (pathname.endsWith('/query')) {
        if (layerId === 0) return { objectIds: [31, 32, 33, 34] };
        if (layerId === 1) return { objectIds: [11] };
        if (layerId === 2) return { objectIds: [21, 22] };
        return { objectIds: [] };
    }

    const features: Record<number, { attributes: Record<string, unknown>; geometry?: object }> = {
        11: {
            attributes: getMockKvrAttributes(11, '100', MOCK_KVR_NAME),
            geometry: {
                rings: [
                    [
                        [581420, 6060420],
                        [581480, 6060420],
                        [581480, 6060480],
                        [581420, 6060480],
                        [581420, 6060420],
                    ],
                ],
            },
        },
        21: {
            attributes: getMockKvrAttributes(21, '100', MOCK_KVR_NAME, {
                Pozonis: 'Apsaugos nuo fizinio poveikio pozonis',
            }),
            geometry: {
                rings: [
                    [
                        [581350, 6060350],
                        [581550, 6060350],
                        [581550, 6060550],
                        [581350, 6060550],
                        [581350, 6060350],
                    ],
                ],
            },
        },
        22: {
            attributes: getMockKvrAttributes(22, '100', MOCK_KVR_NAME, {
                Pozonis: 'Vizualinės apsaugos pozonis',
            }),
            geometry: {
                rings: [
                    [
                        [581300, 6060300],
                        [581600, 6060300],
                        [581600, 6060600],
                        [581300, 6060600],
                        [581300, 6060300],
                    ],
                ],
            },
        },
        31: {
            attributes: getMockKvrAttributes(31, '100', MOCK_KVR_NAME),
            geometry: { x: 581456, y: 6060682 },
        },
        32: {
            attributes: getMockKvrAttributes(32, '200', 'Aušros vartai'),
            geometry: { x: 581850, y: 6060800 },
        },
        33: {
            attributes: getMockKvrAttributes(33, '300', ''),
            geometry: { x: 581150, y: 6060200 },
        },
        34: {
            attributes: getMockKvrAttributes(34, '400', 'Objektas be geometrijos'),
        },
    };

    return { feature: featureId === null ? undefined : features[featureId] };
}

const MOCK_POTREE_SCRIPT = String.raw`
(() => {
  const eventTarget = () => {
    const listeners = new Map();
    return {
      addEventListener(type, callback) {
        const callbacks = listeners.get(type) ?? new Set();
        callbacks.add(callback);
        listeners.set(type, callbacks);
      },
      removeEventListener(type, callback) {
        listeners.get(type)?.delete(callback);
      },
      dispatchEvent(event) {
        listeners.get(event.type)?.forEach((callback) => callback(event));
      },
    };
  };

  const makeVector = (x = 0, y = 0, z = 0) => ({
    x,
    y,
    z,
    set(nextX, nextY, nextZ) {
      this.x = nextX;
      this.y = nextY;
      this.z = nextZ;
      return this;
    },
    copy(source) {
      this.x = source.x;
      this.y = source.y;
      this.z = source.z;
      return this;
    },
    sub(source) {
      this.x -= source.x;
      this.y -= source.y;
      this.z -= source.z;
      return this;
    },
    multiplyScalar(value) {
      this.x *= value;
      this.y *= value;
      this.z *= value;
      return this;
    },
    distanceTo(source) {
      return Math.hypot(this.x - source.x, this.y - source.y, this.z - source.z);
    },
  });

  const makeMeasurement = (options) => ({
    name: options.name,
    showArea: Boolean(options.showArea),
    points: [],
    addMarker(position) {
      this.points.push({ position: position ?? makeVector() });
    },
    removeMarker(index) {
      this.points.splice(index, 1);
    },
    getArea() {
      return this.points.length >= 3 ? 42 : 0;
    },
  });

  const makeProfile = (options) => {
    const profile = {
      ...eventTarget(),
      name: options.name,
      points: [],
      width: options.width,
      addMarker(position) {
        this.points.push(position ?? makeVector());
        this.dispatchEvent({ type: 'marker_added' });
      },
      removeMarker(index) {
        this.points.splice(index, 1);
        this.dispatchEvent({ type: 'marker_removed' });
      },
      setWidth(width) {
        this.width = width;
        this.dispatchEvent({ type: 'width_changed' });
      },
    };
    return profile;
  };

  const makePointCloud = () => {
    const classification = {};
    for (const id of [0, 1, 2, 3, 4, 5, 6, 7]) {
      classification[id] = { color: [1, 1, 1, 1], visible: true };
    }

    const positionArray = new Float32Array([
      581000, 6060000, 86,
      581250, 6060250, 110,
      581500, 6060500, 150,
      581750, 6060750, 180,
      582000, 6061000, 226,
    ]);
    const classificationArray = new Uint8Array([2, 2, 2, 2, 6]);
    const geometry = {
      attributes: {
        position: { array: positionArray, count: 5, itemSize: 3 },
        classification: { array: classificationArray },
      },
    };
    const boundingBox = {
      min: { x: 581000, y: 6060000, z: 86 },
      max: { x: 582000, y: 6061000, z: 226 },
      clone() {
        return {
          min: { ...this.min },
          max: { ...this.max },
          applyMatrix4() {
            return this;
          },
        };
      },
    };

    return {
      boundingBox,
      matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] },
      material: {
        activeAttributeName: 'elevation',
        classification,
        elevationRange: [86, 226],
        intensityBrightness: 0,
        intensityGamma: 1,
        intensityRange: [0, 10000],
        needsUpdate: false,
        recomputeClassification() {},
        shape: 2,
        size: 1,
      },
      pcoGeometry: {
        pointAttributes: {
          attributes: [{ name: 'position', range: [[581000, 6060000, 86], [582000, 6061000, 226]] }],
        },
      },
      getPointsInProfile: (_profile, _maxDepth, handlers) => {
        window.setTimeout(() => {
          handlers.onProgress({
            points: {
              segments: [
                {
                  points: {
                    data: {
                      classification: new Uint8Array([2, 2, 2]),
                      mileage: new Float64Array([0, 10, 20]),
                      position: new Float32Array([
                        581000, 6060000, 86,
                        581010, 6060010, 90,
                        581020, 6060020, 95,
                      ]),
                    },
                    numPoints: 3,
                  },
                },
              ],
            },
          });
          handlers.onFinish();
        }, 0);
        return {
          cancel() {},
          finishLevelThenCancel() {},
        };
      },
      position: { x: 0, y: 0, z: 0 },
      profileRequests: [],
      root: { geometryNode: { geometry } },
      scale: { x: 1, y: 1, z: 1 },
      visibleNodes: [{ geometryNode: { geometry } }],
      removeFromParent() {},
      traverse() {},
      updateMatrixWorld() {},
    };
  };

  class Viewer {
    constructor(container) {
      Object.assign(this, eventTarget());
      this.renderer = {
        domElement: document.createElement('canvas'),
        dispose() {},
        setAnimationLoop() {},
      };
      this.dispose = () => {
        this.renderer.setAnimationLoop(null);
        this.renderer.dispose();
      };
      this.renderer.domElement.width = 800;
      this.renderer.domElement.height = 600;
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      const context = this.renderer.domElement.getContext('2d');
      context.fillStyle = '#123456';
      context.fillRect(0, 0, 800, 600);
      container.appendChild(this.renderer.domElement);

      // Mirror production Potree: it preventDefaults touch events, which
      // suppresses the compatibility mouse events mobile browsers would
      // otherwise synthesize. Touch tools must handle touch events directly.
      this.renderer.domElement.addEventListener('touchstart', (event) =>
        event.preventDefault()
      );
      this.renderer.domElement.addEventListener('touchend', (event) =>
        event.preventDefault()
      );

      const camera = new window.THREE.PerspectiveCamera(60, 4 / 3, 0.1, 10000000);
      camera.position.set(581500, 6060500, 1300);
      camera.up.set(0, 1, 0);
      camera.lookAt(581500, 6060500, 156);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();

      this.scene = {
        annotations: { children: [] },
        measurements: [],
        pointclouds: [],
        profiles: [],
        scene: {
          add() {},
          remove() {},
        },
        volumes: [],
        addPointCloud: (pointcloud) => {
          this.scene.pointclouds.push(pointcloud);
        },
        getActiveCamera: () => camera,
        removeAllMeasurements: () => {
          this.scene.measurements.length = 0;
        },
        addAnnotation: (position, options) => {
          const annotation = {
            position,
            title: options.title,
            description: options.description,
            visible: true,
            moveHere: () => {
              if (!options.cameraPosition || !options.cameraTarget) return;
              document.body.dataset.annotationCameraPosition = options.cameraPosition.join(',');
              document.body.dataset.annotationCameraTarget = options.cameraTarget.join(',');
            },
          };
          this.scene.annotations.children.push(annotation);
          return annotation;
        },
        removeAnnotation: (annotation) => {
          this.scene.annotations.children = this.scene.annotations.children.filter(
            (item) => item !== annotation
          );
        },
        removeMeasurement: (measurement) => {
          this.scene.measurements = this.scene.measurements.filter((item) => item !== measurement);
        },
        removeProfile: (profile) => {
          this.scene.profiles = this.scene.profiles.filter((item) => item !== profile);
        },
        removeVolume: (volume) => {
          this.scene.volumes = this.scene.volumes.filter((item) => item !== volume);
        },
        view: {
          position: makeVector(581500, 6060500, 300),
          yaw: 0,
          pitch: -1.570796,
          radius: 100,
          getPivot: () => makeVector(581500, 6060500, 100),
          lookAt() {},
        },
      };
      this.measuringTool = {
        startInsertion: (options) => {
          const measurement = makeMeasurement(options);
          this.scene.measurements.push(measurement);
          return measurement;
        },
      };
      this.profileTool = {
        startInsertion: (options) => {
          const profile = makeProfile(options);
          this.scene.profiles.push(profile);
          return profile;
        },
      };
      this.volumeTool = {
        startInsertion: (options) => {
          const volume = { name: options.name, getVolume: () => 123 };
          this.scene.volumes.push(volume);
          return volume;
        },
      };
      this.earthControls = {};
      this.orbitControls = {};
      this.mobileMapControls = { doubleTapZoomEnabled: true };
      this.useHQ = false;
    }

    fitToScreen() {}
    setBackground(value) { this.background = value; }
    setCameraMode(value) { this.cameraMode = value; }
    setClassificationVisibility(id, visible) {
      for (const pointcloud of this.scene.pointclouds) {
        if (pointcloud.material.classification[id]) {
          pointcloud.material.classification[id].visible = visible;
        }
      }
    }
    setControls(value) { this.controls = value; }
    setDescription(value) { this.description = value; }
    setEDLEnabled(value) { this.edlEnabled = value; }
    setEDLRadius(value) { this.edlRadius = value; }
    setEDLStrength(value) { this.edlStrength = value; }
    setFOV(value) { this.fov = value; }
    setMinNodeSize(value) { this.minNodeSize = value; }
    setPointBudget(value) { this.pointBudget = value; }
    setReliefAzimuth(value) { this.reliefAzimuth = value; }
    setReliefEnabled(value) { this.reliefEnabled = value; }
    setReliefRadius(value) { this.reliefRadius = value; }
    setReliefStrength(value) { this.reliefStrength = value; }
    setTopView() {
      this.scene.view.position.set(581500, 6060500, 300);
      this.scene.view.yaw = 0;
      this.scene.view.pitch = -1.570796;
      this.scene.view.radius = 100;
    }
  }

  window.Potree = {
    CameraMode: { PERSPECTIVE: 'PERSPECTIVE', ORTHOGRAPHIC: 'ORTHOGRAPHIC' },
    PointShape: { SQUARE: 1, CIRCLE: 2, PARABOLOID: 3 },
    PointSizeType: { FIXED: 1, ADAPTIVE: 2 },
    Utils: {
      createBackgroundTexture: () => document.createElement('canvas'),
      getMousePointCloudIntersection: () => ({
        location: { x: 581500.1234, y: 6060500.5678, z: 100 },
      }),
      loadSkybox: () => ({}),
    },
    Viewer,
    loadPointCloud: (_url, _name, callback) => {
      window.setTimeout(() => callback({ pointcloud: makePointCloud() }), 0);
    },
  };
})();
`;

type MetadataMode = 'ok' | 'not-found' | 'unavailable';
type PotreeMode = 'mock' | 'missing';
type MapLabelsMode = 'ok' | 'unavailable';
type OrthophotoMode = 'ok' | 'unavailable' | 'partial' | 'tiles-unavailable';

const MOCK_ORTHOPHOTO_METADATA = {
    currentVersion: 11.3,
    singleFusedMapCache: true,
    fullExtent: {
        xmin: 300000,
        ymin: 5970000,
        xmax: 700000,
        ymax: 6260000,
        spatialReference: { wkid: 2600, latestWkid: 3346 },
    },
    tileInfo: {
        rows: 256,
        cols: 256,
        origin: { x: -5122000, y: 10000100 },
        lods: [
            { level: 0, resolution: 793.7515875031751, scale: 3000000 },
            { level: 1, resolution: 529.1677250021168, scale: 2000000 },
            { level: 2, resolution: 264.5838625010584, scale: 1000000 },
            { level: 3, resolution: 132.2919312505292, scale: 500000 },
            { level: 4, resolution: 66.1459656252646, scale: 250000 },
            { level: 5, resolution: 26.458386250105836, scale: 100000 },
            { level: 6, resolution: 13.229193125052918, scale: 50000 },
            { level: 7, resolution: 6.614596562526459, scale: 25000 },
            { level: 8, resolution: 2.116670900008467, scale: 8000 },
            { level: 9, resolution: 1.0583354500042335, scale: 4000 },
            { level: 10, resolution: 0.5291677250021167, scale: 2000 },
            { level: 11, resolution: 0.26458386250105836, scale: 1000 },
            { level: 12, resolution: 0.13229193125052918, scale: 500 },
        ],
    },
};

const MOCK_ORTHOPHOTO_TILE_BASE64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

const MOCK_ORTHOPHOTO_SERVICE_NAMES = [
    'NZT/ORT_recent',
    'NZT/ORT10LT_2024_2026',
    'NZT/ORT10LT_2021_2023',
    'NZT/ORT10LT_2018_2020',
    'NZT/ORT10LT_2015',
    'NZT/ORT10LT_2012_2013',
    'NZT/ORT10LT_2009_2010',
    'NZT/ORT10LT_2005_2006',
    'NZT/ORT10LT_1995_2001',
];

function getMockOrthophotoMapName(serviceName: string) {
    // Mirrors production quirks: the 2015 service is named ORT10LT_2015 while
    // its mapName covers 2015-2017, and the 1995 service spans 1995-1999.
    const bareName = serviceName.replace(/^NZT\//, '');
    if (bareName === 'ORT_recent') return 'ORT recent';
    if (bareName === 'ORT10LT_2015') return 'ORT10LT 2015-2017';
    if (bareName === 'ORT10LT_1995_2001') return 'ORT10LT 1995-1999';
    const match = serviceName.match(/ORT10LT_(\d{4})(?:_(\d{4}))?/);
    if (!match) return serviceName;
    const start = match[1];
    const end = match[2] ?? start;
    return `ORT10LT ${start}-${end}`;
}

interface MockViewerOptions {
    metadata?: MetadataMode;
    potree?: PotreeMode;
    mapLabels?: MapLabelsMode;
    orthophoto?: OrthophotoMode;
    orthophotoMissingServices?: string[];
    orthophotoExtraServices?: string[];
    orthophotoMetadataOverrides?: Record<
        string,
        { xmin: number; ymin: number; xmax: number; ymax: number }
    >;
    orthophotoMissingFirstTileServices?: string[];
    orthophotoRecentUnavailable?: boolean;
    orthophotoRecentTilesUnavailable?: boolean;
    sourceManifest?: object;
}

export async function installMockViewer(page: Page, options: MockViewerOptions = {}) {
    const metadataMode = options.metadata ?? 'ok';
    const potreeMode = options.potree ?? 'mock';
    const mapLabelsMode = options.mapLabels ?? 'ok';
    const orthophotoMode = options.orthophoto ?? 'ok';
    const missingServices = options.orthophotoMissingServices ?? [];
    const extraServices = options.orthophotoExtraServices ?? [];
    const metadataOverrides = options.orthophotoMetadataOverrides ?? {};
    const missingFirstTileServices = options.orthophotoMissingFirstTileServices ?? [];
    const recentUnavailable = options.orthophotoRecentUnavailable ?? false;
    const recentTilesUnavailable = options.orthophotoRecentTilesUnavailable ?? false;
    const firstTileBlocked = new Set<string>();
    let orthophotoTileRequest = 0;

    await page.route('**/arcgis/rest/services/NZT**', async (route) => {
        if (orthophotoMode === 'unavailable') {
            await route.fulfill({ status: 503, body: '' });
            return;
        }

        const url = route.request().url();

        if (url.includes('/services/NZT?f=pjson')) {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    services: [...MOCK_ORTHOPHOTO_SERVICE_NAMES, ...extraServices].map((name) => ({
                        name,
                        type: 'MapServer',
                    })),
                }),
            });
            return;
        }

        if (url.includes('/tile/')) {
            // Recent imagery tiles fail while its metadata (and dated
            // services) stay healthy.
            if (recentTilesUnavailable && url.includes('ORT_recent')) {
                await route.fulfill({ status: 503, body: '' });
                return;
            }
            // The first tile requested for the service 404s; neighbors succeed.
            const firstTileService = missingFirstTileServices.find((service) =>
                url.includes(service)
            );
            if (firstTileService && !firstTileBlocked.has(firstTileService)) {
                firstTileBlocked.add(firstTileService);
                await route.fulfill({ status: 404, body: '' });
                return;
            }
            if (missingServices.some((service) => url.includes(service))) {
                await route.fulfill({ status: 404, body: '' });
                return;
            }
            orthophotoTileRequest += 1;
            if (orthophotoMode === 'tiles-unavailable' && !url.includes('/tile/5/')) {
                // L5 probes succeed so the overlay mounts; only renderer tiles fail.
                await route.fulfill({ status: 503, body: '' });
                return;
            }
            if (orthophotoMode === 'partial' && orthophotoTileRequest % 2 === 1) {
                await route.fulfill({ status: 503, body: '' });
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: 'image/png',
                body: Buffer.from(MOCK_ORTHOPHOTO_TILE_BASE64, 'base64'),
            });
            return;
        }

        const serviceMatch = url.match(/\/NZT\/([^/]+)\/MapServer/);
        const bareServiceName = serviceMatch ? serviceMatch[1] : '';
        if (recentUnavailable && bareServiceName === 'ORT_recent') {
            await route.fulfill({ status: 503, body: '' });
            return;
        }
        const metadataOverride = bareServiceName ? metadataOverrides[bareServiceName] : undefined;
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ...MOCK_ORTHOPHOTO_METADATA,
                ...(metadataOverride
                    ? {
                          fullExtent: {
                              ...MOCK_ORTHOPHOTO_METADATA.fullExtent,
                              ...metadataOverride,
                          },
                      }
                    : null),
                mapName: serviceMatch ? getMockOrthophotoMapName(serviceMatch[1]) : '',
            }),
        });
    });

    await page.route(
        'https://www.geoportal.lt/mapproxy/rest/services/kpd_kvr/MapServer/**',
        async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(getMockKvrResponse(route.request().url())),
            });
        }
    );

    await page.route('https://www.geoportal.lt/mapproxy/elasticsearch_gvdr', async (route) => {
        if (mapLabelsMode === 'unavailable') {
            await route.fulfill({ status: 503, body: '' });
            return;
        }

        const records = [
            {
                objectid: '1',
                name: 'Vilnius',
                namestatus: 'oficialus',
                localtype: 'Gyvenvietės',
                subtype: 'miestas',
                LOCATIONX: 25.262998346412513,
                LOCATIONY: 54.675993041365494,
            },
            {
                objectid: '2',
                name: 'Neris',
                namestatus: 'oficialus',
                localtype: 'Hidrografija',
                subtype: 'upė',
                LOCATIONX: 25.269138829765346,
                LOCATIONY: 54.67698920493076,
            },
            {
                objectid: '3',
                name: 'Test Lake',
                namestatus: 'kita',
                localtype: 'Hidrografija',
                subtype: 'ežeras',
                LOCATIONX: 25.258121126836947,
                LOCATIONY: 54.67171261590469,
            },
            {
                objectid: '4',
                name: 'Ignored Peak',
                namestatus: 'kita',
                localtype: 'Reljefas',
                subtype: 'geomorfologinis rajonas',
                LOCATIONX: 25.269138829765346,
                LOCATIONY: 54.67698920493076,
            },
            {
                objectid: '5',
                name: 'Ignored Cafe',
                namestatus: 'oficialus',
                localtype: 'Kita',
                subtype: 'kavinė',
                LOCATIONX: 25.269138829765346,
                LOCATIONY: 54.67698920493076,
            },
            {
                objectid: '6',
                name: 'Outside Village',
                namestatus: 'oficialus',
                localtype: 'Gyvenvietės',
                subtype: 'kaimas',
                LOCATIONX: 25.28730645793723,
                LOCATIONY: 54.68758055884211,
            },
        ];
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                took: 1,
                timed_out: false,
                hits: {
                    total: { value: records.length, relation: 'eq' },
                    hits: records.map((source, index) => ({
                        _index: 'gvdr',
                        _id: String(index + 1),
                        _source: source,
                    })),
                },
            }),
        });
    });

    await page.route('**/potree/potree.js', async (route) => {
        await route.fulfill({
            contentType: 'application/javascript',
            body: potreeMode === 'mock' ? MOCK_POTREE_SCRIPT : 'delete window.Potree;',
        });
    });

    await page.route('**/metadata.json', async (route) => {
        if (metadataMode === 'not-found') {
            await route.fulfill({ status: 404, body: '' });
            return;
        }

        if (metadataMode === 'unavailable') {
            await route.fulfill({ status: 503, body: '' });
            return;
        }

        if (route.request().method() === 'HEAD') {
            await route.fulfill({ status: 200, body: '' });
            return;
        }

        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(MOCK_METADATA),
        });
    });

    await page.route('**/source_manifest.json', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(options.sourceManifest ?? MOCK_SOURCE_MANIFEST),
        });
    });
}

export async function gotoMockedViewer(page: Page, path = CANONICAL_VIEWER_PATH) {
    await installMockViewer(page);
    await page.goto(path);
    await expectViewerReady(page);
}

export async function expectViewerReady(page: Page) {
    const viewerContainer = page.getByTestId('viewer-container');
    await expect(viewerContainer).toBeVisible({ timeout: VIEWER_READY_TIMEOUT_MS });
    await expect(viewerContainer.locator('canvas')).toBeVisible({
        timeout: VIEWER_READY_TIMEOUT_MS,
    });
    await expect(page.getByTestId('viewer-loading-overlay')).toBeHidden();
    await expect(page.getByTestId('viewer-error-overlay')).toBeHidden();
    await expect(page.getByTestId('viewer-sidebar')).toBeVisible();
    await expect(page.getByTestId('viewer-right-rail')).toBeVisible();
}

export async function setRangeValue(page: Page, testId: string, value: string | number) {
    await page.getByTestId(testId).evaluate((element, nextValue) => {
        const input = element as HTMLInputElement;
        const valueSetter = Object.getOwnPropertyDescriptor(
            HTMLInputElement.prototype,
            'value'
        )?.set?.bind(input);
        valueSetter?.(String(nextValue));
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('blur', { bubbles: true }));
        input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    }, String(value));
}

export function getSearchParams(page: Page) {
    return new URL(page.url()).searchParams;
}

export async function expectSearchParam(page: Page, key: string, value: string) {
    await expect.poll(() => getSearchParams(page).get(key)).toBe(value);
}

export async function expectNoSearchParam(page: Page, key: string) {
    await expect.poll(() => getSearchParams(page).has(key)).toBe(false);
}
