module.exports = function (point) {
  var buffer = new ArrayBuffer(3 * Float64Array.BYTES_PER_ELEMENT);
  var dv = new DataView(buffer);
  dv.setFloat64(0, point.timestamp);
  dv.setFloat64(Float64Array.BYTES_PER_ELEMENT, point.lat);
  dv.setFloat64(2 * Float64Array.BYTES_PER_ELEMENT, point.lng);
  return buffer;
}
