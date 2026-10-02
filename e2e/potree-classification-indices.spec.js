import { expect, test } from '@playwright/test';

test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

async function loadRenderer(page) {
    await page.route('**/__point-index-fixture', (route) =>
        route.fulfill({
            contentType: 'text/html',
            body: '<!doctype html><html><body></body></html>',
        })
    );
    await page.goto('/__point-index-fixture');
    for (const url of [
        '/libs/three.js/build/three.min.js',
        '/libs/jquery/jquery-3.7.1.min.js',
        '/libs/proj4/proj4.js',
        '/libs/other/BinaryHeap.js',
        '/libs/tween/tween.min.js',
        '/potree/potree.js',
    ]) {
        await page.addScriptTag({ url });
    }
}

const checkNativeIndices = async () => {
    const canvas = document.createElement('canvas'),
        g = canvas.getContext('webgl2');
    const r = new Potree.Renderer({ getContext: () => g }),
        out = {};
    const geo = (classes) => ({
        attributes: {
            position: {
                array: new Float32Array(3 * classes.length),
                itemSize: 3,
                count: classes.length,
                normalized: false,
                version: 0,
            },
            classification: {
                array: classes,
                itemSize: 1,
                count: classes.length,
                normalized: false,
                version: 0,
            },
        },
        addEventListener() {},
        removeEventListener() {},
    });
    const texture = {
            image: { width: 256, height: 1, data: new Uint8Array(1024).fill(255) },
            version: 0,
        },
        material = { uniforms: { classificationLUT: { value: texture } } };
    const mask = (codes) => {
        texture.image.data.fill(255);
        for (let code of codes) texture.image.data[4 * code + 3] = 0;
        texture.version++;
        return r.getClassificationMask(material);
    };
    const create = (classes) => {
        const geometry = geo(classes),
            buffer = r.createBuffer(geometry);
        r.buffers.set(geometry, buffer);
        g.bindVertexArray(buffer.vao);
        return { geometry, buffer };
    };
    const wait = async (test) => {
        const deadline = performance.now() + 5000;
        while (!test()) {
            if (performance.now() > deadline) throw Error('Fixture timeout');
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
    };
    let f = create(new Uint8Array([5, 2, 5, 7])),
        m = mask([5, 7]);
    out.edlOriginalPath = r.getClassificationMask({ ...material, useEDL: true }) === null;
    out.reliefOriginalPath = r.getClassificationMask({ ...material, weighted: true }) === null;
    out.depthOriginalPath =
        r.getClassificationMask({
            ...material,
            defines: new Map([['use_edl', '#define use_edl']]),
        }) === null;
    out.initialFallback = r.getClassificationIndices(f.geometry, f.buffer, m) === null;
    await wait(() => f.buffer.classificationIndices.ready);
    g.bindVertexArray(f.buffer.vao);
    let s = r.getClassificationIndices(f.geometry, f.buffer, m),
        ids = new Uint16Array(s.count);
    g.getBufferSubData(g.ELEMENT_ARRAY_BUFFER, 0, ids);
    out.uploadedIDs = [...ids];
    out.geometryIntact = [...f.geometry.attributes.classification.array];
    const oldBuffer = s.buffer;
    m = mask([]);
    out.reenableFallback = r.getClassificationIndices(f.geometry, f.buffer, m) === null;
    out.oldBufferDeleted = !g.isBuffer(oldBuffer);
    let a = new Uint8Array(100000).fill(5);
    for (let i = 0; i < a.length; i += 10) a[i] = 2;
    f = create(a);
    m = mask([5]);
    r.getClassificationIndices(f.geometry, f.buffer, m);
    const stale = f.buffer.classificationIndices;
    m = mask([7]);
    out.pendingMaskFallback = r.getClassificationIndices(f.geometry, f.buffer, m) === null;
    await wait(
        () =>
            f.buffer.classificationIndices.ready &&
            !r.classificationIndexJob &&
            r.classificationIndexQueue.length === 0
    );
    out.staleIgnored = !stale.ready && r.getClassificationIndices(f.geometry, f.buffer, m) === null;
    m = mask([5]);
    r.getClassificationIndices(f.geometry, f.buffer, m);
    await wait(() => f.buffer.classificationIndices.ready);
    g.bindVertexArray(f.buffer.vao);
    s = r.getClassificationIndices(f.geometry, f.buffer, m);
    out.largeType = s.type === g.UNSIGNED_INT;
    out.largeCount = s.count;
    ids = new Uint32Array(s.count);
    g.getBufferSubData(g.ELEMENT_ARRAY_BUFFER, 0, ids);
    out.largeFirstLast = [ids[0], ids[ids.length - 1]];
    f.geometry.attributes.classification.array.fill(2);
    f.geometry.attributes.classification.version++;
    out.attributeFallback = r.getClassificationIndices(f.geometry, f.buffer, m) === null;
    await wait(() => f.buffer.classificationIndices.ready);
    out.attributeUpdateIgnoredOldMask =
        r.getClassificationIndices(f.geometry, f.buffer, m) === null;
    f = create(new Uint8Array(100000).fill(5));
    m = mask([5]);
    r.getClassificationIndices(f.geometry, f.buffer, m);
    const disposedState = f.buffer.classificationIndices;
    r.deleteBuffer(f.geometry);
    await wait(() => !r.classificationIndexJob && r.classificationIndexQueue.length === 0);
    out.disposedJobIgnored = !disposedState.ready && !r.buffers.has(f.geometry);
    f = create(new Uint8Array(100000).fill(5));
    r.getClassificationIndices(f.geometry, f.buffer, m);
    r.resetContext();
    out.resetClean =
        r.classificationIndexJob === null &&
        r.classificationIndexQueue.length === 0 &&
        r.classificationIndexWorker === null &&
        r.buffers.size === 0;
    r.classificationIndexUint32 = false;
    f = create(new Uint8Array(65537).fill(5));
    out.unsupportedLargeFallback =
        r.getClassificationIndices(f.geometry, f.buffer, m) === null &&
        r.classificationIndexJob === null &&
        r.classificationIndexQueue.length === 0;
    out.glError = g.getError();
    r.disableClassificationIndices();
    return out;
};

test('native classification indices preserve IDs and invalidate stale worker results', async ({
    page,
}) => {
    await loadRenderer(page);
    const result = await page.evaluate(checkNativeIndices);
    expect(result).toEqual({
        edlOriginalPath: true,
        reliefOriginalPath: true,
        depthOriginalPath: true,
        initialFallback: true,
        uploadedIDs: [1],
        geometryIntact: [5, 2, 5, 7],
        reenableFallback: true,
        oldBufferDeleted: true,
        pendingMaskFallback: true,
        staleIgnored: true,
        largeType: true,
        largeCount: 10000,
        largeFirstLast: [0, 99990],
        attributeFallback: true,
        attributeUpdateIgnoredOldMask: true,
        disposedJobIgnored: true,
        resetClean: true,
        unsupportedLargeFallback: true,
        glError: 0,
    });
});

test('worker failure retains shader filtering and the original geometry', async ({ page }) => {
    await page.route('**/ClassificationIndexWorker.js', (route) => route.abort());
    await loadRenderer(page);
    const result = await page.evaluate(async () => {
        const g = document.createElement('canvas').getContext('webgl2');
        const r = new Potree.Renderer({ getContext: () => g });
        const classes = new Uint8Array([5, 5, 2]);
        const geometry = {
            attributes: {
                position: {
                    array: new Float32Array(9),
                    itemSize: 3,
                    count: 3,
                    normalized: false,
                    version: 0,
                },
                classification: {
                    array: classes,
                    itemSize: 1,
                    count: 3,
                    normalized: false,
                    version: 0,
                },
            },
            addEventListener() {},
            removeEventListener() {},
        };
        const buffer = r.createBuffer(geometry);
        r.buffers.set(geometry, buffer);
        const hidden = new Uint8Array(256);
        hidden[5] = 1;
        const mask = { key: '5', hidden };
        const initialFallback = r.getClassificationIndices(geometry, buffer, mask) === null;
        const deadline = performance.now() + 5000;
        while (!r.classificationIndexDisabled) {
            if (performance.now() > deadline) throw Error('Worker failure timeout');
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        return {
            initialFallback,
            failedFallback: r.getClassificationIndices(geometry, buffer, mask) === null,
            classes: [...classes],
            pending: r.classificationIndexQueue.length,
            worker: r.classificationIndexWorker,
            glError: g.getError(),
        };
    });
    expect(result).toEqual({
        initialFallback: true,
        failedFallback: true,
        classes: [5, 5, 2],
        pending: 0,
        worker: null,
        glError: 0,
    });
});
