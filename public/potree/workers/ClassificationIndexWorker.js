// Keep the original point order, including the IDs used by point picking.
onmessage = function (event) {
	const classes = new Uint8Array(event.data.classification);
	const hidden = event.data.hidden;
	const histogram = new Uint32Array(256);
	let hiddenCount = 0;

	for (let i = 0; i < classes.length; i++) {
		const code = classes[i];
		histogram[code]++;
		hiddenCount += hidden[code];
	}

	const count = classes.length - hiddenCount;
	let indices = null;
	const transfer = [histogram.buffer];
	if (hiddenCount > 0 && hiddenCount >= classes.length * event.data.minHiddenRatio) {
		indices = classes.length <= 65536 ? new Uint16Array(count) : new Uint32Array(count);
		let at = 0;
		for (let i = 0; i < classes.length; i++) {
			if (!hidden[classes[i]]) indices[at++] = i;
		}
		transfer.push(indices.buffer);
	}

	postMessage({ histogram, indices, count }, transfer);
};
