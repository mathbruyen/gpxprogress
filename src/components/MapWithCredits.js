import React, { Component, PropTypes } from 'react';

import { BoundedMap, TileLayer, Point } from './Map';

require('../styles/mapWithCredits.css');

function getTileUrl(zoom, x, y) {
  return `https://blog.mais-h.eu/tiles/${zoom}/${x}/${y}.png`;
}

class MapWithCredits extends Component {

  render() {
    let { topLeft, bottomRight, children } = this.props;
    return React.createElement('div', { className : 'map' },
      React.createElement(BoundedMap, { widthHint : 100, topLeft, bottomRight },
        React.createElement(TileLayer, { maxZoom : 17, minZoom : 0, tilePixels : 256, url : getTileUrl }),
        children
      ),
      React.createElement('span', {},
        'Map data © ',
        React.createElement('a', { href : 'http://openstreetmap.org' }, 'OpenStreetMap'),
        ' contributors'
      )
    );
  }

}

MapWithCredits.propTypes = {

  /**
   * Top left corner.
   */
  topLeft : PropTypes.instanceOf(Point).isRequired,

  /**
   * Bottom right corner.
   */
  bottomRight : PropTypes.instanceOf(Point).isRequired
}

export default MapWithCredits;
