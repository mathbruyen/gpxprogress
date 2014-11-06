'use strict';
/* jshint browser: true */
/* global console */

var L = require('leaflet');
var axios = require('axios');
var Promise = require('es6-promise').Promise;

function local(item, done) {
  var key, doc;
  for (var i = 0; i < localStorage.length; i++) {
    key = localStorage.key(i);
    doc = JSON.parse(localStorage.getItem(key));
    doc.timestamp = parseFloat(key);
    if (!doc.pending) {
      item(doc);
    }
  }
  done();
}

var remote = require('mathsync/json').newSummarizer(function (level) {
  return axios({
    url : '/trace/_design/sync/_view/summary?key=' + level
  }).then(function (response) {
    var rows = response.data.rows;
    if (rows.length === 0) {
      return axios({
        url : '/trace/_design/sync/_list/fullcontent/fullcontent'
      }).then(function (response) {
        return response.data;
      });
    } else {
      return response.data.rows[0].value;
    }
  });
});

function deserialize(buffer) {
  var point = {};
  var dv = new DataView(buffer);
  point.timestamp = dv.getFloat64(0);
  point.lat = dv.getFloat64(Float64Array.BYTES_PER_ELEMENT);
  point.lng = dv.getFloat64(2 * Float64Array.BYTES_PER_ELEMENT);
  return point;
}

var resolver = require('mathsync/skeleton').newResolver(local, remote, require('./serialize'), deserialize);

function login() {
  return axios({ url : '/_session', method : 'post', data : { name : 'mathieu', password : 'testing' }});
}

function addMarker(doc) {
  var marker = document.createElement('map-marker');
  marker.id = 'tracepoint-' + doc.timestamp;
  marker.setAttribute('lat', doc.lat);
  marker.setAttribute('lng', doc.lng);
  document.getElementById('tracemap').appendChild(marker);
}

function localSave(doc, pending) {
  console.log('Adding point', doc);
  localStorage.setItem(doc.timestamp, JSON.stringify({ lat : doc.lat, lng : doc.lng, pending : pending }));
  addMarker(doc);
}

for (var i = 0; i < localStorage.length; i++) {
  let key = localStorage.key(i);
  let doc = JSON.parse(localStorage.getItem(key));
  doc.timestamp = parseFloat(key);
  addMarker(doc);
}

function localDelete(doc) {
  console.log('Removing point', doc);
  localStorage.removeItem(doc.timestamp);
  var marker = document.getElementById('tracepoint-' + doc.timestamp);
  if (marker) {
    marker.parentNode.removeChild(marker);
  }
}

function save(doc, triedLogin) {
  return axios({
    method : 'post',
    url : '/trace',
    headers : { 'Content-Type' : 'application/json' },
    data : { lat : doc.lat, lng : doc.lng, timestamp : doc.timestamp }
  }).then(localSave.bind(null, doc, false), function (response) {
    if (response.status === 401 && !triedLogin) {
      return login().then(save.bind(null, doc, true));
    }
  });
}

function push() {
  var promises = [];
  var key, doc;
  for (var i = 0; i < localStorage.length; i++) {
    key = localStorage.key(i);
    doc = JSON.parse(localStorage.getItem(key));
    doc.timestamp = parseFloat(key);
    if (doc.pending) {
      console.log('Pushing point', doc);
      promises.push(save(doc));
    }
  }
  return Promise.all(promises);
}

function pull() {
  return resolver().then(function (difference) {
    difference.removed.forEach(function (doc) {
      localDelete(doc);
    });
    difference.added.forEach(function (doc) {
      localSave(doc);
    });
  });
}

function wait(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

function sync() {
  console.log('Synchronization starting');
  return push()
    .then(pull)
    .then(console.log.bind(console, 'Synchronization finished'), console.error.bind(console, 'Failed to synchronize:'))
    .then(wait.bind(null, 120000))
    .then(sync);
}

sync();

let button = document.getElementById('push');
if ('geolocation' in navigator) {
  let watchID = null;
  let last;

  let stopListening = function stopListening() {
    if (watchID !== null) {
      navigator.geolocation.clearWatch(watchID);
      button.innerHTML = 'Start';
      watchID = null;
    }
  };

  document.getElementById('push').addEventListener('click', function () {
    if (watchID !== null) {
      stopListening();
    } else {
      watchID = navigator.geolocation.watchPosition(function(position) {
        var current = { timestamp : position.timestamp, lat : position.coords.latitude, lng : position.coords.longitude };
        if (!last || L.latLng(current.lat, current.lng).distanceTo([last.lat, last.lng]) > 20) {
          localSave(current, true);
          last = current;
        }
      }, stopListening);
      button.innerHTML = 'Stop';
    }
  }, false);
} else {
  button.setAttribute('disabled', true);
  button.innerHTML = 'Geolocation not available';
}

var TraceMap = Object.create(HTMLElement.prototype);

TraceMap.createdCallback = function () {
  var div = document.createElement('div');
  div.style.height = '100%';
  this.appendChild(div);

  this.map = L.map(div);
  L.tileLayer('http://otile3.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', { attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">' }).addTo(this.map);

  this.map.on('moveend', e => {
    this.setAttribute('lat', this.map.getCenter().lat);
    this.setAttribute('lng', this.map.getCenter().lng);
  });

  this.map.on('zoomend', e => {
    this.setAttribute('zoom', this.map.getZoom());
  });

  var lat = parseFloat(this.getAttribute('lat')) || 0;
  var lng = parseFloat(this.getAttribute('lng')) || 0;
  this.map.panTo([lat, lng]);

  var zoom = parseInt(this.getAttribute('zoom'), 10) || 1;
  this.map.setZoom(zoom);
};

TraceMap.attributeChangedCallback = function(attrName, oldVal, newVal) {
  if (attrName === 'lat') {
    let lat = parseFloat(newVal);
    if (!isNaN(lat) && (this.map.getCenter().lat !== lat)) {
      this.map.panTo([lat, this.map.getCenter().lng]);
    }
  }
  if (attrName === 'lng') {
    let lng = parseFloat(newVal);
    if (!isNaN(lng) && (this.map.getCenter().lng !== lng)) {
      this.map.panTo([this.map.getCenter().lat, lng]);
    }
  }
  if (attrName === 'zoom') {
    let zoom = parseInt(newVal, 10);
    if (!isNaN(zoom) && (zoom !== this.map.getZoom())) {
      this.map.setZoom(zoom);
    }
  }
};

document.registerElement('trace-map', {
  prototype : TraceMap
});

var MapMarker = Object.create(HTMLElement.prototype);

MapMarker.createdCallback = function() {
  this.readAttributes();
};

MapMarker.attachedCallback = function() {
  if (TraceMap.isPrototypeOf(this.parentElement)) {
    this.map = this.parentElement.map;
    if (this.marker) {
      this.marker.addTo(this.map);
    }
  }
};

MapMarker.detachedCallback = function() {
  if (this.map && this.marker) {
    this.map.removeLayer(this.marker);
  }
  delete this.map;
};

MapMarker.attributeChangedCallback = function() {
  this.readAttributes();
};

MapMarker.readAttributes = function() {
  var lat = parseFloat(this.getAttribute('lat'));
  var lng = parseFloat(this.getAttribute('lng'));

  if (this.marker && this.map) {
    this.map.removeLayer(this.marker);
  }
  delete this.marker;

  if (!isNaN(lat) && !isNaN(lng)) {
    //this.marker = L.marker([lat, lng], { icon : L.icon({ iconAnchor : [12.5, 41], iconSize : [25, 41], iconUrl : 'http://cdn.leafletjs.com/leaflet-0.7.3/images/marker-icon.png' })});
    this.marker = L.circle([lat, lng], 10, { stroke : false, fillColor : '#F00', fillOpacity : 1 });
    if (this.map) {
      this.marker.addTo(this.map);
    }
  }
};

document.registerElement('map-marker', {
  prototype : MapMarker
});
