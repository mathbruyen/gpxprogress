require('./typedarrays');

var ibf = require('mathsync/lib/ibf');
var sha1 = require('mathsync/lib/sha1');
var selector = require('mathsync/lib/bucketSelector').padAndHash(sha1, 3);

module.exports = function (keys, values, rereduce) {
  var result;
  if (rereduce) {
    result = ibf.fromJSON(values[0], sha1, selector);
    for (var i = 1; i < values.length; i++) {
      result = result.plusIbf(ibf.fromJSON(values[i], sha1, selector));
    }
  } else {
    result = ibf(Math.pow(2, keys[0][0]), sha1, selector);
    for (var i = 0; i < values.length; i++) {
      result = result.plus(new Uint8Array(values[i]).buffer);
    }
  }
  return result.toJSON();
}
