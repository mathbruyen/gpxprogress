/**
 * Reactive/isomorphic maps.
 *
 * TODO: auto bounded map? (asking to its children for required bounds)
 * TODO: centered map?
 */
import React, { Component, PropTypes } from 'react';

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

class MapConfiguration {

  constructor(topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, width) {
    this.topLeftLng = topLeftLng;
    this.topLeftLat = topLeftLat;
    this.bottomRightLng = bottomRightLng;
    this.bottomRightLat = bottomRightLat;

    this.width = width;

    this.topLeftX = lngToX(topLeftLng);
    this.topLeftY = latToY(topLeftLat);
    this.bottomRightX = lngToX(bottomRightLng);
    this.bottomRightY = latToY(bottomRightLat);
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
 */
class BoundedMap extends Component {

  render() {
    // TODO handle maps displayed on tiles edge
    let { width, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, children } = this.props;
    let config = new MapConfiguration(topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, width);

    // Displayed part coordinates
    let viewBox = `${config.topLeftX} ${config.topLeftY} ${config.mapWidth} ${config.mapHeight}`;

    // Physical height
    let height = width * config.aspectRatio;

    let configuredChildren = React.Children.map(children, (c) => React.cloneElement(c, { __mapConfig : config }));
    return React.createElement('svg', { width, height, viewBox }, configuredChildren);
  }

}

BoundedMap.propTypes = {
  /**
   * Expected width in pixels of the final element.
   *
   * TODO: allow to provide height or diagonal?
   */
  width : PropTypes.number.isRequired,

  /**
   * Top left corner.
   */
  topLeftLat : PropTypes.number.isRequired,
  topLeftLng : PropTypes.number.isRequired,

  /**
   * Bottom right corner.
   */
  bottomRightLat : PropTypes.number.isRequired,
  bottomRightLng : PropTypes.number.isRequired
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
    let { lat, lng, r } = this.props;
    return React.createElement('circle', { cx : lngToX(lng), cy : latToY(lat), r : metersToSize(r), fill : 'red' })
  }

}

Disc.propTypes = {
  /**
   * Disc center.
   */
  lat : PropTypes.number.isRequired,
  lng : PropTypes.number.isRequired,

  /**
   * Radius of the disc in meters.
   */
  r : PropTypes.number.isRequired
}

class Path extends Component {

  render() {
    let { points, w } = this.props;
    let d = points.map((point, idx) => {
      let x = lngToX(point[1]);
      let y = latToY(point[0]);
      if (idx == 0) {
        return `M${x} ${y}`;
      } else {
        return `L${x} ${y}`;
      }
    }).join(' ');
    return React.createElement('path', { d, strokeWidth : metersToSize(w), stroke : 'red', fill : 'none' });
  }

}

Path.propTypes = {
  /**
   * Points as an array of [lat, lng] items.
   */
  points : PropTypes.array.isRequired,

  /**
   * Line width of the path in meters.
   */
  w : PropTypes.number.isRequired,
}

export { BoundedMap, TileLayer, Path, Disc };
