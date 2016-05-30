import React, { Component, PropTypes } from 'react';

require('../styles/map.css');

// Zoom starts from 0 for which there is a single tile
// Each time zoom increases the x and y number of tiles doubles

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

class Map extends Component {

  render() {
    // TODO handle maps displayed on tiles edge
    let { width, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, children } = this.props;

    // Displayed part coordinates
    let topLeftX = lngToX(topLeftLng);
    let topLeftY = latToY(topLeftLat);
    let bottomRightX = lngToX(bottomRightLng);
    let bottomRightY = latToY(bottomRightLat);
    let viewBox = `${topLeftX} ${topLeftY} ${bottomRightX - topLeftX} ${bottomRightY - topLeftY}`;

    // Physical height
    let height = width * (bottomRightY - topLeftY) / (bottomRightX - topLeftX);

    let configuredChildren = React.Children.map(children, (c) => React.cloneElement(c, { __map : this }));
    return React.createElement('svg', { width, height, viewBox }, configuredChildren);
  }

}

Map.propTypes = {
  width : PropTypes.number.isRequired, // TODO either give width, height or diagonal size
  topLeftLat : PropTypes.number.isRequired,
  topLeftLng : PropTypes.number.isRequired,
  bottomRightLat : PropTypes.number.isRequired,
  bottomRightLng : PropTypes.number.isRequired
}

class TileLayer extends Component {

  render() {
    let { url, tilePixels, minZoom, maxZoom, __map } = this.props;
    let { width, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng } = __map.props;

    let percent = (bottomRightLng - topLeftLng) / (2 * MAX_LONGITUDE);
    let zoom = Math.max(minZoom, Math.min(maxZoom, Math.ceil(log2(width / (tilePixels * percent)))));

    let side = powerOf2(zoom);

    let topLeftX = lngToX(topLeftLng);
    let bottomRightX = lngToX(bottomRightLng);
    let mapWidth = bottomRightX - topLeftX;
    let xRange = getTilesRange(topLeftX, mapWidth, side);

    let topLeftY = latToY(topLeftLat);
    let bottomRightY = latToY(bottomRightLat);
    let mapHeight = bottomRightY - topLeftY;
    let yRange = getTilesRange(topLeftY, mapHeight, side);

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
  minZoom : PropTypes.number.isRequired,
  maxZoom : PropTypes.number.isRequired,
  tilePixels : PropTypes.number.isRequired,
  url : PropTypes.func.isRequired
}

class Disc extends Component {

  render() {
    let { lat, lng, r } = this.props;
    return React.createElement('circle', { cx : lngToX(lng), cy : latToY(lat), r : metersToSize(r), fill : 'red' })
  }

}

Disc.propTypes = {
  lat : PropTypes.number.isRequired,
  lng : PropTypes.number.isRequired,
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
  points : PropTypes.array.isRequired,
  w : PropTypes.number.isRequired,
}

export { Map, TileLayer, Path, Disc };
