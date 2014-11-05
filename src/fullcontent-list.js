require('./typedarrays');

var emptyContent = require('mathsync/lib/fullContent');

module.exports = function () {
  var fc = emptyContent;
  var row;
  while (row = getRow()) {
    fc = fc.plus(new Uint8Array(row.value).buffer);
  }
  send(JSON.stringify(fc.toJSON()));
}
