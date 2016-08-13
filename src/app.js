import { createStore } from 'redux';
import ReactDOM from 'react-dom';
import React from 'react';
import { BoundedMap, TileLayer, Path, Point, SvgScaledDrawing } from './components/Map';
import Marker from './components/Marker';
import Immutable from 'immutable';

require('./styles/app.css');

const p = [
  [43.695138, 7.267997],
  [43.695132, 7.2679],
  [43.695126, 7.267639],
  [43.69505, 7.26675],
  [43.695016, 7.26586],
  [43.695002, 7.264975],
  [43.694936, 7.264179],
  [43.694882, 7.263265],
  [43.69484, 7.262401],
  [43.694763, 7.261356],
  [43.694642, 7.260379],
  [43.694482, 7.259431],
  [43.69434, 7.258413],
  [43.694121, 7.257467],
  [43.693871, 7.256471],
  [43.693644, 7.255491],
  [43.693397, 7.254497],
  [43.693222, 7.253548],
  [43.693008, 7.25262],
  [43.692811, 7.251704],
  [43.692509, 7.250814],
  [43.692184, 7.249892],
  [43.691882, 7.24903],
  [43.691606, 7.24814],
  [43.691309, 7.247269],
  [43.690977, 7.2464],
  [43.690677, 7.245555],
  [43.69037, 7.244684],
  [43.690046, 7.243813],
  [43.689672, 7.242999],
  [43.689251, 7.242183],
  [43.688824, 7.241441],
  [43.688413, 7.240632],
  [43.687968, 7.239854],
  [43.687462, 7.239131],
  [43.687004, 7.238374],
  [43.68649, 7.237682],
  [43.685983, 7.236992],
  [43.685341, 7.236251],
  [43.684785, 7.23564],
  [43.684238, 7.235028],
  [43.683701, 7.234433],
  [43.683146, 7.233842],
  [43.682613, 7.233284],
  [43.682091, 7.232684],
  [43.681557, 7.232081],
  [43.681003, 7.231547],
  [43.680384, 7.231016],
  [43.67978, 7.230562],
  [43.679165, 7.230118],
  [43.678553, 7.229693],
  [43.677978, 7.2292],
  [43.677346, 7.22882],
  [43.676679, 7.228431],
  [43.676042, 7.228085],
  [43.675398, 7.227721],
  [43.674769, 7.227308],
  [43.674126, 7.226954],
  [43.67352, 7.22663],
  [43.672895, 7.226155],
  [43.67232, 7.225655],
  [43.671782, 7.22501],
  [43.671279, 7.224355],
  [43.670827, 7.223688],
  [43.670333, 7.223002],
  [43.669828, 7.222371],
  [43.669329, 7.2217],
  [43.668831, 7.220997],
  [43.669168, 7.221526],
  [43.669628, 7.222196],
  [43.670111, 7.222873],
  [43.670635, 7.223536],
  [43.671104, 7.22423],
  [43.671591, 7.224907],
  [43.672126, 7.225526],
  [43.672678, 7.226064],
  [43.673246, 7.226538],
  [43.673865, 7.226968],
  [43.674516, 7.227315],
  [43.675154, 7.227649],
  [43.675811, 7.228039],
  [43.676436, 7.228416],
  [43.677104, 7.228746],
  [43.677708, 7.229159],
  [43.67834, 7.229559],
  [43.678937, 7.22997],
  [43.679586, 7.230466],
  [43.68022, 7.230972],
  [43.680813, 7.231453],
  [43.68138, 7.23206],
  [43.681931, 7.232638],
  [43.682467, 7.233187],
  [43.683043, 7.233801],
  [43.683573, 7.234408],
  [43.68411, 7.234973],
  [43.684674, 7.235589],
  [43.685226, 7.236241],
  [43.68575, 7.236852],
  [43.686259, 7.237484],
  [43.68674, 7.238141],
  [43.687236, 7.238819],
  [43.687678, 7.23959],
  [43.688084, 7.240358],
  [43.688505, 7.241098],
  [43.688979, 7.241889],
  [43.689374, 7.242649],
  [43.689765, 7.243458],
  [43.690136, 7.244327],
  [43.690446, 7.245167],
  [43.690807, 7.246015],
  [43.691085, 7.246878],
  [43.691384, 7.247766],
  [43.691747, 7.248648],
  [43.692033, 7.249528],
  [43.692351, 7.250408],
  [43.692628, 7.251274],
  [43.692855, 7.252188],
  [43.693053, 7.253119],
  [43.693254, 7.254051],
  [43.693466, 7.255054],
  [43.693678, 7.25604],
  [43.693884, 7.257023],
  [43.694105, 7.257996],
  [43.69429, 7.258967],
  [43.694456, 7.259966],
  [43.694616, 7.260982],
  [43.694734, 7.262002],
  [43.694856, 7.263022],
  [43.694908, 7.264104],
  [43.694995, 7.265218],
  [43.695028, 7.266307],
  [43.694966, 7.26658],
  [43.694959, 7.266805],
  [43.694963, 7.266904]
];
let i = 0;

let State = Immutable.Record({
  center : new Point({ lat : 43.695949, lng : 7.271413 }),
  d : 0.05,
  points : Immutable.List()
});

function counter(state = new State(), action) {
  switch (action.type) {
  case 'ZOOM_IN':
    return state.set('d', state.d / 2);
  case 'ZOOM_OUT':
    return state.set('d', state.d * 2);
  case 'ADD_POINT':
    let [lat, lng] = p[i++];
    let point = new Point({ lat, lng });
    return state.set('points', state.points.push(point));
  default:
    return state;
  }
}

function getTileUrl(zoom, x, y) {
  return `https://blog.mais-h.eu/tiles/${zoom}/${x}/${y}.png`;
}

const store = createStore(counter);

window.onload = function () {
  const rootEl = document.getElementById('root');

  function render() {
    let { d, center, points } = store.getState();
    let topLeft = new Point({ lat : center.lat + d, lng : center.lng - d });
    let bottomRight = new Point({ lat : center.lat - d, lng : center.lng + d });
    ReactDOM.render(
      React.createElement('div', {},
        React.createElement('div', { className : 'map' },
          React.createElement(BoundedMap, { widthHint : 100, topLeft, bottomRight },
            React.createElement(TileLayer, { maxZoom : 17, minZoom : 0, tilePixels : 256, url : getTileUrl }),
            React.createElement(Marker, { position : center, pixels : 100 }),
            React.createElement(SvgScaledDrawing, { origin : center, meters : 500, points : 100 },
              React.createElement('circle', { r : 50, fill : 'red' })
            ),
            React.createElement(Path, { w : 50, points })
          ),
          React.createElement('span', {},
            'Map data © ',
            React.createElement('a', { href : 'http://openstreetmap.org' }, 'OpenStreetMap'),
            ' contributors'
          )
        ),
        React.createElement('button', { onClick : () => store.dispatch({ type: 'ZOOM_IN' }) }, '+'),
        React.createElement('button', { onClick : () => store.dispatch({ type: 'ZOOM_OUT' }) }, '-'),
        React.createElement('button', { onClick : () => store.dispatch({ type: 'ADD_POINT' }) }, 'Add point')
      ),
      rootEl
    );
  }

  render();
  store.subscribe(render);
};
