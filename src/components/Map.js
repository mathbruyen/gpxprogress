/**
 * Reactive/isomorphic maps.
 *
 * Beware that this is using [React context](https://facebook.github.io/react/docs/context.html) to pass map information
 * to map items: intermediate layers must ensure their `shouldComponentUpdate` method returns `false` in case context
 * key `mapConfig` changes, even though they do not use that context key (see
 * [#2517](https://github.com/facebook/react/issues/2517)).
 */
import React, { Component, PropTypes } from 'react';
import Immutable from 'immutable';
import ReactDOM from 'react-dom';

import '../styles/map.css';

const RESOLUTION = Math.pow(2, 20);
const MAX_LONGITUDE = 180;
const EARTH_RADIUS = 6378137;

function log2(x) {
  return Math.log(x) / Math.LN2;
}

function latToY(lat) {
  // Spherical mercator
  const sin = Math.sin(lat * Math.PI / 180);// [-90, 90] -> [-1, 1]
  const spherical = Math.log((1 + sin) / (1 - sin));// [-90, -85, 85, 90] -> [-Infinity, -2 * PI, 2 * PI, Infinity]
  const inRange = Math.min(Math.max(spherical / (2 * Math.PI), -1), 1);// [-90, -85, 85, 90] -> [-1, -1, 1, 1]
  return - RESOLUTION * inRange / 2;// [-90, -85, 85, 90] -> [RESOLUTION / 2, RESOLUTION / 2, - RESOLUTION / 2, - RESOLUTION / 2]
}

function lngToX(lng) {
  // Linear
  return (RESOLUTION * lng) / (MAX_LONGITUDE * 2);// [-180, 180] -> [- RESOLUTION / 2, RESOLUTION / 2]
}

function powerOf2(exponent) {
  return Math.round(Math.pow(2, exponent));
}

// TODO this should be latitude dependent
function metersToSize(meters) {
  // Using equator as reference: 2 * PI * EARTH_RADIUS -> RESOLUTION
  return meters * RESOLUTION / (EARTH_RADIUS * Math.PI * 2);
}

function getTilesRange(start, length, tiles) {
  // width = (RESOLUTION / tiles)
  // x = (n * width) - (RESOLUTION / 2)

  // x + width >= start
  let first = Math.ceil((start * tiles / RESOLUTION) - 1 + (tiles / 2));

  // x <= start + length
  let last = Math.floor(((start + length) * tiles / RESOLUTION) + (tiles / 2));

  return [first, last];
}

const Point = Immutable.Record({ lat : 0, lng : 0 });

const MapConfiguration = Immutable.Record({
  topLeftX : 0,
  topLeftY : 0,
  bottomRightX : 0,
  bottomRightY : 0,
  width : 0,
  height : 0
});

class MapConfigurationHelper extends Component {

  render() {
    return React.createElement('g', {}, this.props.children);
  }

  getChildContext() {
    return { mapConfig : this.props.mapConfig };
  }

}

MapConfigurationHelper.propTypes = {
  mapConfig : PropTypes.instanceOf(MapConfiguration).isRequired
};

MapConfigurationHelper.childContextTypes = {
  mapConfig : PropTypes.instanceOf(MapConfiguration).isRequired
};

class TileLoading extends Component {

  render() {
    return React.createElement('circle', { cx : '0.5', cy : '0.5', r : '0.4', stroke: 'black', strokeWidth: '0.1', fill : 'red' });
  }
}

class MapDefinitions extends Component {

  render() {
    return React.createElement('defs', null,
      React.createElement('g', { id : 'TileLoading' }, React.createElement(TileLoading))
    );
  }
}

/**
 * Map defined by its bounds (top-left and bottom-right corners)
 *
 * TODO handle maps displayed on tiles edge
 */
class BoundedMap extends Component {

  render() {
    // Map configuration width actual size if already measured
    let { widthHint, topLeft, bottomRight, children } = this.props;

    let topLeftX = lngToX(topLeft.lng);
    let topLeftY = latToY(topLeft.lat);
    let bottomRightX = lngToX(bottomRight.lng);
    let bottomRightY = latToY(bottomRight.lat);

    let boundsAspectRatio = (bottomRightY - topLeftY) / (bottomRightX - topLeftX);

    let width, height;
    if (this.state && this.state.width && this.state.height) {
      // actual size measured in browser
      width = this.state.width;
      height = this.state.height;
      let realAspectRatio = height / width;
      if (realAspectRatio > boundsAspectRatio) {
        // higher box than expected, increase latitudes
        let increase = ((bottomRightX - topLeftX) * realAspectRatio - bottomRightY + topLeftY) / 2;
        topLeftY -= increase;
        bottomRightY += increase;
      } else {
        // wider box than expected, increase longitudes
        let increase = ((bottomRightY - topLeftY) / realAspectRatio - bottomRightX + topLeftX) / 2;
        topLeftX -= increase;
        bottomRightX += increase;
      }
    } else {
      // size as requested for static generation
      width = widthHint;
      height = widthHint * boundsAspectRatio;
    }

    let mapConfig = new MapConfiguration({ topLeftX, topLeftY, bottomRightX, bottomRightY, width, height });

    // Displayed part coordinates
    let viewBox = `${topLeftX} ${topLeftY} ${bottomRightX - topLeftX} ${bottomRightY - topLeftY}`;

    return React.createElement('svg', { viewBox, preserveAspectRatio : 'xMidYMid slice' },
      React.createElement(MapDefinitions),
      React.createElement(MapConfigurationHelper, { mapConfig }, children)
    );
  }

  componentDidMount() {
    this.__measure();
  }

  componentWillReceiveProps() {
    // TODO watch for element size changes rather than waiting for properties change
    this.__measure();
  }

  __measure() {
    let node = ReactDOM.findDOMNode(this);
    let style = window.getComputedStyle(node, null);
    let width = parseInt(style.getPropertyValue('width').substring(-2), 10);
    let height = parseInt(style.getPropertyValue('height').substring(-2), 10);
    this.setState({ width, height });
  }

}

BoundedMap.propTypes = {
  /**
   * Expected width in pixels of the final element.
   *
   * Used for static and initial rendering, then state is used to track the actual element width and adjust.
   *
   * TODO: allow to provide height or diagonal?
   */
  widthHint : PropTypes.number.isRequired,

  /**
   * Top left corner.
   */
  topLeft : PropTypes.instanceOf(Point).isRequired,

  /**
   * Bottom right corner.
   */
  bottomRight : PropTypes.instanceOf(Point).isRequired
};

class TileLayer extends Component {

  constructor(props) {
    super(props);
    this._loading = {};
  }

  render() {
    let { url, tilePixels, minZoom, maxZoom } = this.props;
    let mapConfig = this.context.mapConfig;

    // Zoom 0 has a single tile for the whole world, each time zoom increases the x and y number of tiles doubles
    let percent = (mapConfig.bottomRightX - mapConfig.topLeftX) / RESOLUTION;
    let zoom = Math.max(minZoom, Math.min(maxZoom, Math.ceil(log2(mapConfig.width / (tilePixels * percent)))));

    let side = powerOf2(zoom);
    let xRange = getTilesRange(mapConfig.topLeftX, mapConfig.bottomRightX - mapConfig.topLeftX, side);
    let yRange = getTilesRange(mapConfig.topLeftY, mapConfig.bottomRightY - mapConfig.topLeftY, side);

    let tiles = [];
    let tileSize = RESOLUTION / side;
    for (let xidx = xRange[0]; xidx <= xRange[1]; xidx++) {
      let x = (xidx * RESOLUTION / side) - (RESOLUTION / 2);
      for (let yidx = yRange[0]; yidx <= yRange[1]; yidx++) {
        let y = - (RESOLUTION / 2) + (yidx * RESOLUTION / side);
        tiles.push(React.createElement('image', {
          key : `${zoom}-${xidx}-${yidx}`,
          x, y,
          width : tileSize, height : tileSize,
          xlinkHref : url(zoom, xidx, yidx),
          ref : this.imageRef.bind(this, `${zoom}-${xidx}-${yidx}`)
        }));
      }
    }
    return React.createElement('g', {}, tiles);
  }

  /**
   * Display loading indicator, only if image load takes more than a frame.
   */
  imageRef(id, image) {
    this.clearImageRef(id);
    if (image) {
      this._loading[id] = 'prepared';
      let time = setTimeout(() => {
        if (this._loading[id] === 'prepared') {
          let el = document.createElementNS('http://www.w3.org/2000/svg', 'use');
          let x = image.getAttribute('x');
          let y = image.getAttribute('y');
          let w = image.getAttribute('width');
          let h = image.getAttribute('height');
          el.setAttribute('transform', `translate(${x} ${y}) scale(${w} ${h})`);
          el.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#TileLoading');
          this._loading[id] = el;
          image.parentNode.appendChild(el);
          image.onload = () => this.imageRef(id);
        } else {
          this.clearImageRef(id);
        }
      }, 60);
      image.onload = () => clearTimeout(time);
    }
  }

  clearImageRef(id) {
    if (this._loading[id]) {
      let el = this._loading[id];
      delete this._loading[id];
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }
  }

}

TileLayer.propTypes = {
  /**
   * Computing size URL.
   *
   * @parameter zoom the requested zoom level
   * @param x the tile x coordinate (from 0 to 2^zoom - 1)
   * @param y the tile y coordinate (from 0 to 2^zoom - 1)
   */
  url : PropTypes.func.isRequired,

  /**
   * Available zoom range.
   */
  minZoom : PropTypes.number.isRequired,
  maxZoom : PropTypes.number.isRequired,

  /**
   * The size of a single tile (used to compute best zoom level).
   */
  tilePixels : PropTypes.number.isRequired
};

TileLayer.contextTypes = {
  mapConfig : PropTypes.instanceOf(MapConfiguration).isRequired
};

class SvgScaledDrawing extends Component {

  render () {
    let { origin, points, meters } = this.props;
    let x = lngToX(origin.lng);
    let y = latToY(origin.lat);
    let scale = metersToSize(meters) / points;
    let transform = `translate(${x} ${y}) scale(${scale} ${scale})`;
    return React.createElement('g', { transform }, this.props.children);
  }

}

SvgScaledDrawing.propTypes = {
  /**
   * Coordinates of the drawing origin.
   */
  origin : PropTypes.instanceOf(Point).isRequired,

  /**
   * Scaling the drawing: points in SVG coordinates correspond to meters in real display
   *
   * With { points : 100, meters : 50 } a SVG circle with r="100" will appear with a radius 50 meters on the map. If
   * using { points : 100, meters : 1500 } the same circle will appear with a radius of 1500 meters.
   */
  points : PropTypes.number.isRequired,
  meters : PropTypes.number.isRequired
};

class SvgFixedDrawing extends Component {

  render () {
    let { origin, points, pixels } = this.props;
    let mapConfig = this.context.mapConfig;
    let x = lngToX(origin.lng);
    let y = latToY(origin.lat);
    let scale = (pixels * (mapConfig.bottomRightX - mapConfig.topLeftX)) / (points * mapConfig.width);
    let transform = `translate(${x} ${y}) scale(${scale} ${scale})`;
    return React.createElement('g', { transform }, this.props.children);
  }

}

SvgFixedDrawing.propTypes = {
  /**
   * Coordinates of the drawing origin.
   */
  origin : PropTypes.instanceOf(Point).isRequired,

  /**
   * Scaling the drawing: points in SVG coordinates correspond to pixels in final image
   *
   * With { points : 100, pixels : 50 } a SVG circle with r="100" will appear with a radius 50 pixels on the final
   * image. If using { points : 100, pixels : 1500 } the same circle will appear with a radius of 1500 pixels.
   */
  points : PropTypes.number.isRequired,
  pixels : PropTypes.number.isRequired
};

SvgFixedDrawing.contextTypes = {
  mapConfig : PropTypes.instanceOf(MapConfiguration).isRequired
};

class Path extends Component {

  render() {
    let { points, w } = this.props;
    if (points.size < 2) {
      return null;
    }
    let d = points.map((point, idx) => {
      let x = lngToX(point.lng);
      let y = latToY(point.lat);
      if (idx === 0) {
        return `M${x} ${y}`;
      } else {
        return `L${x} ${y}`;
      }
    }).join(' ');
    return React.createElement('path', { d, strokeWidth : metersToSize(w), stroke : 'red', fill : 'none' });
  }

  shouldComponentUpdate(nextProps) {
    let { points, w } = this.props;
    return nextProps.w !== w || nextProps.points !== points;
  }

}

Path.propTypes = {
  /**
   * Points as a List<Point> items.
   */
  points : PropTypes.instanceOf(Immutable.List).isRequired,

  /**
   * Line width of the path in meters.
   */
  w : PropTypes.number.isRequired,
};

export { BoundedMap, TileLayer, Path, SvgFixedDrawing, SvgScaledDrawing, Point };
