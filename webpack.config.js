var webpack = require('webpack');
var HtmlWebpackPlugin = require('html-webpack-plugin');
var ExtractTextPlugin = require('extract-text-webpack-plugin');

/**
 * File names include hash only for production builds.
 */
function buildChunkName(base) {
  return (process.env.NODE_ENV === 'production') ? '[chunkhash].' + base : base;
}

var plugins = [
  new webpack.optimize.CommonsChunkPlugin('vendor', buildChunkName('vendor.js')),
  new ExtractTextPlugin(buildChunkName('app.css')),
  new webpack.EnvironmentPlugin(['NODE_ENV']),
  new HtmlWebpackPlugin({ template : 'src/index.html', inject : false })
];
if (process.env.NODE_ENV === 'production') {
  plugins.push(new webpack.optimize.UglifyJsPlugin({ compress : { warnings : false }}));
}

/**
 * Packages all frontend sources
 *
 * Webpack: http://webpack.github.io/docs/
 * Babel loader with ES2015 presets: https://github.com/babel/babel-loader
 * HTML webpack plugin with custom template: https://github.com/ampedandwired/html-webpack-plugin
 * UglifyJS minification: http://webpack.github.io/docs/list-of-plugins.html#uglifyjsplugin
 * Stylesheet extraction as separate files: http://webpack.github.io/docs/stylesheets.html
 * Compile libraries with development flags off: https://webpack.github.io/docs/list-of-plugins.html#environmentplugin
 */
module.exports = {
  entry: {
    app: './src/app.js',
    vendor: ['react', 'react-dom', 'redux', 'immutable'],
  },
  output: {
    path: './dist',
    filename: buildChunkName('app.js')
  },
  module: {
    loaders: [{
      test: /\.js$/,
      loader: 'babel',
      query: {
        presets: ['es2015']
      }
    }, {
      test: /\.css$/,
      loader: ExtractTextPlugin.extract('style-loader', 'css-loader')
    }]
  },
  plugins: plugins
};
