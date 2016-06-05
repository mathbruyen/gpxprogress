/**
 * Reactive/isomorphic maps.
 *
 * TODO: auto bounded map? (asking to its children for required bounds)
 * TODO: centered map?
 */
import React, { Component, PropTypes } from 'react';
import Immutable from 'immutable';
import ReactDOM from 'react-dom';

require('../styles/map.css');

const RESOLUTION = 10000000;
const MAX_LATITUDE = 90;
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

function metersToSize(meters) {
  // Using longitude as basis: 2 * PI * EARTH_RADIUS -> RESOLUTION
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

class MapConfiguration {

  constructor(topLeft, bottomRight, width) {
    this.topLeftLng = topLeft.lng;
    this.topLeftLat = topLeft.lat;
    this.bottomRightLng = bottomRight.lng;
    this.bottomRightLat = bottomRight.lat;

    this.width = width;

    this.topLeftX = lngToX(this.topLeftLng);
    this.topLeftY = latToY(this.topLeftLat);
    this.bottomRightX = lngToX(this.bottomRightLng);
    this.bottomRightY = latToY(this.bottomRightLat);
  }

  get mapWidth() {
    return this.bottomRightX - this.topLeftX;
  }

  get mapHeight() {
    return this.bottomRightY - this.topLeftY;
  }

  get aspectRatio() {
    return (this.bottomRightY - this.topLeftY) / (this.bottomRightX - this.topLeftX);
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
    let width = (this.state && this.state.width) || widthHint;
    let config = new MapConfiguration(topLeft, bottomRight, width);


    // Displayed part coordinates
    let viewBox = `${config.topLeftX} ${config.topLeftY} ${config.mapWidth} ${config.mapHeight}`;

    // Physical height
    let height = width * config.aspectRatio;

    let configuredChildren = React.Children.map(children, (c) => React.cloneElement(c, { __mapConfig : config }));
    return React.createElement('svg', { width, height, viewBox }, configuredChildren);
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
    let style = window.getComputedStyle(node, null).getPropertyValue('width');
    let measured = parseInt(style.substring(-2), 10);
    this.setState({ width : measured });
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
}

// TODO manage tiles directly in map elements? (avoids having map injecting properties in its children)
class TileLayer extends Component {

  render() {
    let { url, tilePixels, minZoom, maxZoom, __mapConfig } = this.props;

    // Zoom 0 has a single tile for the whole world, each time zoom increases the x and y number of tiles doubles
    let percent = (__mapConfig.bottomRightLng - __mapConfig.topLeftLng) / (2 * MAX_LONGITUDE);
    let zoom = Math.max(minZoom, Math.min(maxZoom, Math.ceil(log2(__mapConfig.width / (tilePixels * percent)))));

    let side = powerOf2(zoom);
    let xRange = getTilesRange(__mapConfig.topLeftX, __mapConfig.mapWidth, side);
    let yRange = getTilesRange(__mapConfig.topLeftY, __mapConfig.mapHeight, side);

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
          xlinkHref : url(zoom, xidx, yidx)
        }));
      }
    }
    return React.createElement('g', {}, tiles);
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
}

class Disc extends Component {

  render() {
    let { center, radius } = this.props;
    let cx = lngToX(center.lng);
    let cy = latToY(center.lat);
    let r = metersToSize(radius);
    return React.createElement('circle', { cx, cy, r, fill : 'red' });
  }

}

Disc.propTypes = {
  /**
   * Disc center.
   */
  center : PropTypes.instanceOf(Point).isRequired,

  /**
   * Radius of the disc in meters.
   */
  radius : PropTypes.number.isRequired
}

class Path extends Component {

  render() {
    let { points, w } = this.props;
    if (points.size < 2) {
      return null;
    }
    let d = points.map((point, idx) => {
      let x = lngToX(point.lng);
      let y = latToY(point.lat);
      if (idx == 0) {
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
}

export { BoundedMap, TileLayer, Path, Disc, Point };
