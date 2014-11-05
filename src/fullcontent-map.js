require('./typedarrays');

var toArrayBuffer = require('./serialize');

// framework
module.exports = function (doc) {
  var buffer = toArrayBuffer(doc);
  if (buffer) {
    var arr = new Array(buffer.byteLength);
    var dv = new DataView(buffer);
    for (var i = 0; i < buffer.byteLength; i++) {
      arr[i] = dv.getUint8(i);
    }
    emit(null, arr);
  }
}
