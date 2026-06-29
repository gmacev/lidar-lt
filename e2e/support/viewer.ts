import { expect, type Page } from '@playwright/test';

export const CANONICAL_CELL_ID = '76_32';
const CANONICAL_SECTOR_NAME = 'VILNIUS (centras)';
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

const MOCK_KVR_ATTRIBUTES = {
    ObjectId: '100',
    Code: 'KVR-100',
    Name: 'Gedimino kalno, pilies bokšto ir Aukštutinės pilies pastatų komplekso liekanos',
    NameOfficial: 'Gedimino kalno, pilies bokšto ir Aukštutinės pilies pastatų komplekso liekanos',
    ObjectName: 'bokštas',
    Status: 'Registrinis',
    Address: 'Arsenalo g. 5, Vilnius',
};

function getMockKvrResponse(url: string) {
    if (url.includes('/pub_kvr_objektai/MapServer/1/query')) {
        return {
            features: [
                {
                    attributes: MOCK_KVR_ATTRIBUTES,
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
            ],
        };
    }

    if (url.includes('/pub_kvr_apsaugos_zonos/MapServer/0/query')) {
        return {
            features: [
                {
                    attributes: {
                        ...MOCK_KVR_ATTRIBUTES,
                        ShapeType: 'Apsaugos zona',
                        Area: 4200,
                    },
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
            ],
        };
    }

    if (url.includes('/pub_kvr_apsaugos_zonos/MapServer/1/query')) {
        return { features: [] };
    }

    return {
        features: [
            {
                attributes: MOCK_KVR_ATTRIBUTES,
                geometry: { x: 581456, y: 6060682 },
            },
            {
                attributes: {
                    ObjectId: '200',
                    Code: 'KVR-200',
                    Name: 'Aušros vartai',
                    NameOfficial: 'Aušros vartai',
                    ObjectName: 'vartai',
                    Status: 'Registrinis',
                    Address: 'Aušros Vartų g. 14, Vilnius',
                },
                geometry: { x: 581850, y: 6060800 },
            },
            {
                attributes: {
                    ObjectId: '300',
                    Code: 'KVR-300',
                    Name: '',
                    NameOfficial: '',
                    ObjectName: '',
                    Status: 'Registrinis',
                    Address: '',
                },
                geometry: { x: 581150, y: 6060200 },
            },
            {
                attributes: {
                    ObjectId: '400',
                    Code: 'KVR-400',
                    Name: 'Objektas be geometrijos',
                    NameOfficial: 'Objektas be geometrijos',
                    ObjectName: '',
                    Status: 'Registrinis',
                    Address: '',
                },
            },
        ],
    };
}

const MOCK_MAP_TILE_BASE64 =
    'Go4CeAIKBXBsYWNlKIAgEhUSCgAAAQACAAMBBAIYASIFCeovijUSFRIKAAMBBAIDAwUEBhgBIgUJ3jLIMhIVEgoABwEIAgcDBQQGGAEiBQnwDIo1Eg8SBAAJAwoYASIFCZg0ijUaBG5hbWUaB25hbWU6bHQaB25hbWVfZW4aBWNsYXNzGgRyYW5rIgkKB1ZpbG5pdXMiBgoEY2l0eSICKAEiDgoMVGVzdCBWaWxsYWdlIhMKEUJhbmRvbWFzaXMga2FpbWFzIgkKB3ZpbGxhZ2UiAigFIhEKD091dHNpZGUgVmlsbGFnZSIPCg1VPyBzZWt0b3JpYXVzIg4KDElnbm9yZWQgUGVhayIGCgRwZWFrGm94AgoKd2F0ZXJfbmFtZSiAIBITEggAAAEBAgADAhgBIgUJ9CzMNxoEbmFtZRoHbmFtZTpsdBoHbmFtZV9lbhoFY2xhc3MiCwoJVGVzdCBMYWtlIhMKEUJhbmRvbWFzaXMgZXplcmFzIgYKBGxha2UajAF4AgoId2F0ZXJ3YXkogCASGBIIAAABAAIAAwEYAiIKCYAqjjoK0guJChIUEgQAAgMDGAIiCgmAKsw3CtILiQoaBG5hbWUaB25hbWU6bHQaB25hbWVfZW4aBWNsYXNzIgcKBU5lcmlzIgcKBXJpdmVyIhAKDklnbm9yZWQgU3RyZWFtIggKBnN0cmVhbQ==';

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
    const classificationArray = new Uint8Array([2, 2, 2, 2, 2]);
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
      this.renderer.domElement.width = 800;
      this.renderer.domElement.height = 600;
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      const context = this.renderer.domElement.getContext('2d');
      context.fillStyle = '#123456';
      context.fillRect(0, 0, 800, 600);
      container.appendChild(this.renderer.domElement);

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
        removeAnnotation: () => {},
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
      getMousePointCloudIntersection: () => ({ location: { x: 581500.1234, y: 6060500.5678 } }),
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

interface MockViewerOptions {
    metadata?: MetadataMode;
    potree?: PotreeMode;
    mapLabels?: MapLabelsMode;
}

export async function installMockViewer(page: Page, options: MockViewerOptions = {}) {
    const metadataMode = options.metadata ?? 'ok';
    const potreeMode = options.potree ?? 'mock';
    const mapLabelsMode = options.mapLabels ?? 'ok';

    await page.route('https://kvr.kpd.lt/arcgis/rest/services/KVR/**/query?**', async (route) => {
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(getMockKvrResponse(route.request().url())),
        });
    });

    await page.route('https://tiles.openfreemap.org/planet', async (route) => {
        if (mapLabelsMode === 'unavailable') {
            await route.fulfill({ status: 503, body: '' });
            return;
        }
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                tilejson: '3.0.0',
                minzoom: 14,
                maxzoom: 14,
                tiles: ['https://tiles.openfreemap.org/test/{z}/{x}/{y}.pbf'],
            }),
        });
    });

    await page.route('https://tiles.openfreemap.org/test/**', async (route) => {
        const isFixtureTile = route.request().url().endsWith('/14/9341/5207.pbf');
        await route.fulfill({
            status: 200,
            contentType: 'application/x-protobuf',
            body: isFixtureTile ? Buffer.from(MOCK_MAP_TILE_BASE64, 'base64') : Buffer.alloc(0),
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
            body: JSON.stringify(MOCK_SOURCE_MANIFEST),
        });
    });
}

export async function gotoMockedViewer(page: Page, path = CANONICAL_VIEWER_PATH) {
    await installMockViewer(page);
    await page.goto(path);
    await expectViewerReady(page);
}

export async function expectViewerReady(page: Page) {
    await expect(page.getByTestId('viewer-loading-overlay')).toBeHidden();
    await expect(page.getByTestId('viewer-error-overlay')).toBeHidden();
    await expect(page.getByTestId('viewer-container').locator('canvas')).toBeVisible();
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
