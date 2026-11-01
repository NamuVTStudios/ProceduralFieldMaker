importScripts('../Classes/Map/Filters/GaussianBlurFilter.js', '../Classes/Map/Filters/ThresholdFilter.js');

self.onmessage = event => {
  const payload = event.data;
  try {
    const buffer = new Uint8Array(payload.buffer);
    const mapData = { ...payload.dimensions, materials: payload.materials };
    const result = applyRequestedFilter(payload.filterName, buffer, mapData, payload.options);
    self.postMessage({ id: payload.id, buffer: result.buffer }, [result.buffer]);
  } catch (error) {
    self.postMessage({ id: payload.id, error: error.message });
  }
};

function applyRequestedFilter(filterName, buffer, mapData, options) {
  if (filterName === 'gaussian-blur') return GaussianBlurFilter.applyBuffer(buffer, mapData, options);
  if (filterName === 'threshold') return ThresholdFilter.applyBuffer(buffer, mapData, options);
  throw new Error(`Filtro desconocido: ${filterName}`);
}
