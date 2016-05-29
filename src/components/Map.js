import React, { Component, PropTypes } from 'react';

require('../styles/map.css');

// Zoom starts from 0 for which there is a single tile
// Each time zoom increases the x and y number of tiles doubles

const RESOLUTION = 1000;
const MAX_LATITUDE = 90;
const MAX_LONGITUDE = 180;

function latToY(lat) {
  // Spherical mercator
  const sin = Math.sin(lat * Math.PI / 180);
  const spherical = Math.log((1 + sin) / (1 - sin)) / (2 * Math.PI);
  return - RESOLUTION * Math.min(Math.max(spherical, -1), 1) / 2;
}

function lngToX(lng) {
  return (RESOLUTION * lng) / (MAX_LONGITUDE * 2);
}

function powerOf2(exponent) {
  return Math.round(Math.pow(2, exponent));
}

function getTilesRange(start, length, tiles) {
  return [
    Math.ceil((start * tiles / RESOLUTION) - 1 + (tiles / 2)),
    Math.floor((start * tiles / RESOLUTION) + (length * tiles / RESOLUTION) + (tiles / 2))
  ];
}

class Map extends Component {

  render() {
    // TODO zoom could be devised from full bounds and actual svg size
    // TODO handle maps displayed on tiles edge
    let { zoom, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, children } = this.props;
    let topLeftX = lngToX(topLeftLng);
    let topLeftY = latToY(topLeftLat);
    let bottomRightX = lngToX(bottomRightLng);
    let bottomRightY = latToY(bottomRightLat);
    let height = bottomRightY - topLeftY;
    let width = bottomRightX - topLeftX;
    let configuredChildren = React.Children.map(children, (c) => React.cloneElement(c, { mapProps : this.props }));
    return React.createElement('svg', { width, height, viewBox : `${topLeftX} ${topLeftY} ${width} ${height}` }, configuredChildren);
  }

}

Map.propTypes = {
  zoom : PropTypes.number.isRequired,
  topLeftLat : PropTypes.number.isRequired,
  topLeftLng : PropTypes.number.isRequired,
  bottomRightLat : PropTypes.number.isRequired,
  bottomRightLng : PropTypes.number.isRequired
}

class TileLayer extends Component {

  render() {
    let { url, mapProps } = this.props;
    let { zoom, topLeftLat, topLeftLng, bottomRightLat, bottomRightLng, children } = mapProps;

    let side = powerOf2(zoom);

    let topLeftX = lngToX(topLeftLng);
    let bottomRightX = lngToX(bottomRightLng);
    let width = bottomRightX - topLeftX;
    let xRange = getTilesRange(topLeftX, width, side);

    let topLeftY = latToY(topLeftLat);
    let bottomRightY = latToY(bottomRightLat);
    let height = bottomRightY - topLeftY;
    let yRange = getTilesRange(topLeftY, height, side);

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
  url : PropTypes.func.isRequired
}

class Disc extends Component {

  render() {
    let { lat, lng, r } = this.props;
    // TODO how is the user supposed to give a size? (depends on svg end size and RESOLUTION)
    return React.createElement('circle', { cx : lngToX(lng), cy : latToY(lat), r, fill : 'red' })
  }

}

Disc.propTypes = {
  lat : PropTypes.number.isRequired,
  lng : PropTypes.number.isRequired,
  r : PropTypes.number.isRequired
}

class Path extends Component {

  render() {
    let { points } = this.props;
    let d = points.map((point, idx) => {
      let x = lngToX(point[1]);
      let y = latToY(point[0]);
      if (idx == 0) {
        return `M${x} ${y}`;
      } else {
        return `L${x} ${y}`;
      }
    }).join(' ');
    return React.createElement('path', { d, stroke : 'red', fill : 'none' })
  }

}

Path.propTypes = {
  points : PropTypes.array.isRequired,
}

export { Map, TileLayer, Path, Disc };
