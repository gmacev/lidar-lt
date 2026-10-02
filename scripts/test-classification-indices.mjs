import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(
    new URL('../public/potree/workers/ClassificationIndexWorker.js', import.meta.url),
    'utf8'
);

function run(classes, codes, minHiddenRatio = 0.2) {
    const hidden = new Uint8Array(256);
    for (const code of codes) hidden[code] = 1;
    let result;
    let transferred;
    const context = vm.createContext({
        Uint8Array,
        Uint16Array,
        Uint32Array,
        postMessage(message, transfer) {
            result = message;
            transferred = transfer;
        },
    });
    vm.runInContext(source, context);
    context.onmessage({ data: { classification: classes.buffer, hidden, minHiddenRatio } });
    return { ...result, transferred };
}

test('retains point order and original picking IDs across multiple hidden classes', () => {
    const result = run(new Uint8Array([5, 2, 7, 6, 5, 2]), [5, 7]);
    assert.deepEqual([...result.indices], [1, 3, 5]);
    assert.equal(result.count, 3);
    assert.equal(result.histogram[5], 2);
    assert.equal(result.histogram[2], 2);
    assert.equal(result.histogram[7], 1);
    assert.ok(result.transferred.includes(result.indices.buffer));
    assert.ok(result.transferred.includes(result.histogram.buffer));
});

test('keeps shader filtering for sparse masks and fully visible nodes', () => {
    assert.equal(run(new Uint8Array([7, ...new Array(9).fill(2)]), [7]).indices, null);
    assert.equal(run(new Uint8Array([2, 5, 7]), []).indices, null);
});

test('returns an empty index list when a node is entirely hidden', () => {
    const result = run(new Uint8Array([5, 5, 5]), [5]);
    assert.equal(result.count, 0);
    assert.equal(result.indices.length, 0);
});

test('uses 16-bit indices through point ID 65535 and 32-bit indices above it', () => {
    const small = new Uint8Array(65536).fill(5);
    small[65535] = 2;
    const smallResult = run(small, [5]);
    assert.ok(smallResult.indices instanceof Uint16Array);
    assert.deepEqual([...smallResult.indices], [65535]);

    const large = new Uint8Array(65537).fill(5);
    large[65536] = 2;
    const largeResult = run(large, [5]);
    assert.ok(largeResult.indices instanceof Uint32Array);
    assert.deepEqual([...largeResult.indices], [65536]);
});

test('applies the complete lookup-table mask, including high classification codes', () => {
    const result = run(new Uint8Array([0, 39, 255, 7]), [39, 255]);
    assert.deepEqual([...result.indices], [0, 3]);
    assert.equal(result.histogram[255], 1);
});
