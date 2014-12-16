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

records.subscribeOnError(err => console.error('Error with GPS', err));

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

function login() {
  return axios({ url : '/_session', method : 'post', data : { name : 'mathieu', password : 'testing' }});
}

var additions = new Rx.Subject();
var deletions = new Rx.Subject();

function onNewPoint({ lat, lng, timestamp }) {
  localStorage.setItem(timestamp, JSON.stringify({ lat, lng, pending : true }));
  additions.onNext({ lat, lng, timestamp });
}
records.subscribe(onNewPoint);

var local = Rx.Observable.create(function (observer) {
  for (var i = 0; i < localStorage.length; i++) {
    let key = localStorage.key(i);
    let doc = JSON.parse(localStorage.getItem(key));
    doc.timestamp = parseFloat(key);
    observer.onNext(doc);
  }
  observer.onCompleted();
});

var confirmed = local.filter(pos => !pos.pending);
var toConfirm = local.filter(pos => !!pos.pending).map(({ lat, lng, timestamp }) => ({ lat, lng, timestamp }));

var resolver = require('mathsync/observable').newResolver(confirmed, remote, require('./serialize'), deserialize);

function onConfirmPoint({ lat, lng, timestamp }) {
  localStorage.setItem(timestamp, JSON.stringify({ lat, lng }));
}

function save(doc, triedLogin) {
  return axios({
    method : 'post',
    url : '/trace',
    headers : { 'Content-Type' : 'application/json' },
    data : { lat : doc.lat, lng : doc.lng, timestamp : doc.timestamp }
  }).then(null, function (response) {
    if (response.status === 401 && !triedLogin) {
      return login().then(() => save(doc, true));
    } else {
      // TODO more details
      throw new Error('Failed to synchronize ' + doc);
    }
  }).then(() => onConfirmPoint(doc)).then(() => doc);
}

function push() {
  return new Promise((resolve, reject) => {
    toConfirm.flatMap(save).subscribe(doc => console.log('Pushed point', doc), reject, resolve);
  });
}

function onSyncPoint(doc) {
  onConfirmPoint(doc);
  additions.onNext(doc);
}

function onDeletePoint({ lat, lng, timestamp }) {
  localStorage.removeItem(timestamp);
  deletions.onNext({ lat, lng, timestamp });
}

function pull() {
  return resolver().then(function (difference) {
    difference.removed.forEach(onDeletePoint);
    difference.added.forEach(onSyncPoint);
  });
}

var mutex = Promise.resolve();
function start() {
  mutex = mutex
    .then(() => console.log('Synchronization starting'))
    .then(push)
    .then(pull)
    .then(() => console.log('Synchronization finished'), err => console.error('Failed to synchronize:', err));
}

Rx.Observable.interval(120000).subscribe(start);

deletions.subscribe(({ timestamp }) => {
  var marker = document.getElementById('tracepoint-' + timestamp);
  if (marker) {
    marker.parentNode.removeChild(marker);
  }
});

var points = additions.merge(local);

points.subscribe(({ lat, lng, timestamp }) => {
  var marker = document.createElement('map-marker');
  marker.id = 'tracepoint-' + timestamp;
  marker.setAttribute('lat', lat);
  marker.setAttribute('lng', lng);
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
