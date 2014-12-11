'use strict';
/* jshint browser: true, esnext: true */
/* global console */

var L = require('leaflet');
var axios = require('axios');
var Promise = require('es6-promise').Promise;
var Rx = require('rx/dist/rx.lite.js');

// Button to enable/disable GPS tracking
var recordButton = (function () {
  var button = document.getElementById('push');

  if ('geolocation' in navigator) {
    button.removeAttribute('disabled');
    button.innerHTML = 'Start recording';
    return Rx.Observable.fromEvent(button, 'click')
      .scan(false, active => !active)
      .doAction(active => button.innerHTML = active ? 'Stop recording' : 'Start recording');
  } else {
    button.innerHTML = 'Geolocation not available';
    return Rx.Observable.of(false);
  }
})();

// Raw GPS sensor
var gps = Rx.Observable.create(function (observer) {
  var watchId = window.navigator.geolocation.watchPosition(loc => observer.onNext(loc), err => observer.onError(err));
  return () => window.navigator.geolocation.clearWatch(watchId);
}).map(({ timestamp, coords : { latitude : lat, longitude : lng } }) => ({ timestamp, lat, lng }));

// Throttled GPS sensor => emits only if position moved enought or if last point was recorded long ago
var records = gps.pausable(recordButton)
  .share()
  .distinctUntilChanged(
    x => x,
    (latest, current) => current.timestamp - latest.timestamp >= 60000 ||
        L.latLng(current.lat, current.lng).distanceTo([latest.lat, latest.lng]) > 20
  );

function localSave(doc, pending) {
  console.log('Adding point', doc);
  localStorage.setItem(doc.timestamp, JSON.stringify({ lat : doc.lat, lng : doc.lng, pending : pending }));
}

records.subscribe(position => localSave(position, true), err => console.error('Error with GPS', err));

// Locally saved points and completes
var local = Rx.Observable.create(function (observer) {
  for (var i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    let doc = JSON.parse(localStorage.getItem(key));
    doc.timestamp = parseFloat(key);
    observer.onNext(doc);
  }
  observer.onCompleted();
});

// Locally saved points safe for synchronization
var localSynchronized = local.filter(pos => !pos.pending);

var additions = new Rx.Subject();
var deletions = new Rx.Subject();

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
  var dv = new DataView(buffer);
  var timestamp = dv.getFloat64(0);
  var lat = dv.getFloat64(Float64Array.BYTES_PER_ELEMENT);
  var lng = dv.getFloat64(2 * Float64Array.BYTES_PER_ELEMENT);
  return { timestamp, lat, lng };
}

var resolver = require('mathsync/observable').newResolver(localSynchronized, remote, require('./serialize'), deserialize);

function login() {
  return axios({ url : '/_session', method : 'post', data : { name : 'mathieu', password : 'testing' }});
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
    difference.removed.forEach(point => deletions.onNext(point));
    difference.added.forEach(point => additions.onNext(point));
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

additions.subscribe(doc => localSave(doc, false));

deletions.subscribe(doc => {
  console.log('Removing point', doc);
  localStorage.removeItem(doc.timestamp);
  var marker = document.getElementById('tracepoint-' + doc.timestamp);
  if (marker) {
    marker.parentNode.removeChild(marker);
  }
});

// Locally saved points initially followed by recorded and synchronized ones (never completes)
var points = local.merge(records, additions);

points.subscribe(doc => {
  var marker = document.createElement('map-marker');
  marker.id = 'tracepoint-' + doc.timestamp;
  marker.setAttribute('lat', doc.lat);
  marker.setAttribute('lng', doc.lng);
  document.getElementById('tracemap').appendChild(marker);
});

// Button enabling/disabling following last point
var followButton = (function () {
  var button = document.getElementById('follow');
  return Rx.Observable.fromEvent(button, 'click')
    .scan(false, active => !active)
    .doAction(active => button.innerHTML = active ? 'Stop following' : 'Start following');
})();

// Moves map center
let map = document.getElementById('tracemap');
points.pausable(followButton)
  .distinctUntilChanged(x => x, (latest, current) => current.timestamp > latest.timestamp)
  .subscribe(({ lng, lat }) => {
    map.setAttribute('lng', lng);
    map.setAttribute('lat', lat);
  });

var TraceMap = Object.create(HTMLElement.prototype);

TraceMap.createdCallback = function () {
  var div = document.createElement('div');
  div.style.height = '100%';
  this.appendChild(div);

  this.map = L.map(div);
  L.tileLayer('http://otile3.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', { attribution: 'Tiles Courtesy of <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png">' }).addTo(this.map);

  this.map.on('moveend', () => {
    if (!this.ignoreMoveEnd) {
      this.setAttribute('lat', this.map.getCenter().lat);
      this.setAttribute('lng', this.map.getCenter().lng);
    }
    delete this.ignoreMoveEnd;
  });

  this.map.on('zoomend', () => {
    if (!this.ignoreMoveEnd) {
      this.setAttribute('zoom', this.map.getZoom());
    }
    delete this.ignoreZoomEnd;
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
      this.ignoreMoveEnd = true;
    }
  }
  if (attrName === 'lng') {
    let lng = parseFloat(newVal);
    if (!isNaN(lng) && (this.map.getCenter().lng !== lng)) {
      this.map.panTo([this.map.getCenter().lat, lng]);
      this.ignoreMoveEnd = true;
    }
  }
  if (attrName === 'zoom') {
    let zoom = parseInt(newVal, 10);
    if (!isNaN(zoom) && (zoom !== this.map.getZoom())) {
      this.map.setZoom(zoom);
      this.ignoreZoomEnd = true;
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
