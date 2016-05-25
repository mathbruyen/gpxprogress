import React, { Component, PropTypes } from 'react';

require('../styles/Counter.css');

class Counter extends Component {

  constructor(props) {
    super(props);
  }

  render() {
    const { value, onIncrement, onDecrement } = this.props;
    return React.createElement('p', {},
      `Clicked ${value} times`,
      React.createElement('button', { onClick : onIncrement }, '+'),
      React.createElement('button', { onClick : onDecrement }, '-')
    );
  }
}

Counter.propTypes = {
  value: PropTypes.number.isRequired,
  onIncrement: PropTypes.func.isRequired,
  onDecrement: PropTypes.func.isRequired
}

export default Counter;
