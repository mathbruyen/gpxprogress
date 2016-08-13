import React, { Component, PropTypes } from 'react';

import { Point, SvgFixedDrawing } from './Map';

class Marker extends Component {

  render () {
    let { position, pixels, __mapConfig } = this.props;
    return React.createElement(SvgFixedDrawing, { origin : position, pixels, points : 100, __mapConfig },
      React.createElement('path', { d : 'M0,0 L20,-20 L35,-20 Q40,-20 40-25 L40,-95 Q40,-100 35,-100 L-35,-100 Q-40,-100 -40,-95 L-40,-25 Q-40,-20 -35,-20 L-20,-20 Z', fill : 'rgb(121, 184, 247)', stroke : 'rgb(28, 134, 240)' })
    );
  }

}

Marker.propTypes = {
  /**
   * Coordinates of the marker position.
   */
  position : PropTypes.instanceOf(Point).isRequired,
  /**
   * Marker size in pixels.
   */
  pixels : PropTypes.number.isRequired
}

export default Marker;
