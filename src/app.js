import { createStore } from 'redux';
import ReactDOM from 'react-dom';
import React from 'react';
import Counter from './components/Counter';

require('./styles/app.css');

function counter(state = 0, action) {
  switch (action.type) {
  case 'INCREMENT':
    return state + 1;
  case 'DECREMENT':
    return state - 1;
  default:
    return state;
  }
}

const store = createStore(counter);

window.onload = function () {
  const rootEl = document.getElementById('root');

  function render() {
    ReactDOM.render(
      React.createElement(Counter, {
        value : store.getState(),
        onIncrement : () => store.dispatch({ type: 'INCREMENT' }),
        onDecrement : () => store.dispatch({ type: 'DECREMENT' })
      }),
      rootEl
    );
  }

  render();
  store.subscribe(render);
};
