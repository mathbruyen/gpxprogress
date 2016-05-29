import { createStore } from 'redux';
import ReactDOM from 'react-dom';
import React from 'react';
import { Map, TileLayer, Path, Disc } from './components/Map';

require('./styles/app.css');

function counter(state = { lat : 43.695949, lng : 7.271413, zoom : 5, d : 5 }, action) {
  switch (action.type) {
  case 'INCREMENT':
    return { lat : state.lat, lng : state.lng, zoom : state.zoom + 1, d : state.d };
  case 'DECREMENT':
    return { lat : state.lat, lng : state.lng, zoom : state.zoom - 1, d : state.d };
  default:
    return state;
  }
}

const store = createStore(counter);

window.onload = function () {
  const rootEl = document.getElementById('root');

  function render() {
    let { d, lat, lng, zoom } = store.getState();
    ReactDOM.render(
      React.createElement('div', {},
        React.createElement(Map, { zoom, topLeftLat : lat + d, topLeftLng : lng - d, bottomRightLat : lat - d, bottomRightLng : lng + d },
          React.createElement(TileLayer, { url : (zoom, x, y) => `https://blog.mais-h.eu/tiles/1.0.0/map/${zoom}/${x}/${y}.png` }),
          React.createElement(Disc, { lat, lng, r : 0.2 }),
          React.createElement(Path, { points : [[lat + d / 2, lng], [lat, lng + d / 2], [lat - d / 2, lng], [lat, lng - d / 2], [lat + d / 2, lng]] })
        ),
        React.createElement('button', { onClick : () => store.dispatch({ type: 'INCREMENT' }) }, '+'),
        React.createElement('button', { onClick : () => store.dispatch({ type: 'DECREMENT' }) }, '-')
      ),
      rootEl
    );
  }

  render();
  store.subscribe(render);
};
