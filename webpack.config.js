const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const WebpackCdnPlugin = require('webpack-cdn-plugin');
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: {
    main: path.resolve(__dirname, 'app/app.js')
  },
  output: {
    filename: '[name].[contenthash:8].js',
    path: path.resolve(__dirname, 'dist')
  },
  devServer: {
    contentBase: path.join(__dirname, 'dist'),
    compress: true,
    port: 8000,
    proxy: {
      '/v1': {
        target: 'https://devapi.adsabs.harvard.edu',
        changeOrigin: true
      }
    }
  },
  resolve: {
    modules: [
      'app', 'node_modules'
    ],
    alias: {
      'discovery.vars': path.resolve(__dirname, 'app.config.js'),
      'utils': path.resolve(__dirname, 'app/utils.js'),
      'cache': 'dsjslib/lib/Cache.js',
      'underscore': 'lodash/dist/lodash.compat.js',
      'marionette': 'backbone.marionette',
      'jsonpath': 'jsonpath/jsonpath.js'
    }
  },
  module: {
    rules: [
      {
        test: /\.m?js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: [ '@babel/preset-react', '@babel/preset-env' ]
          }
        }
      },
      {
        test: /\.html$/,
        exclude: /(node_modules)/,
        use: {
          loader: 'handlebars-loader',
          options: {
            helperDirs: path.resolve(__dirname, 'app/helpers/handlebars'),
            partialDirs: path.resolve(__dirname, 'app'),
            extensions: '.html'
          }
        }
      },
      {
        test: /\.s?css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          {
            loader: 'postcss-loader',
            options: {
              plugins: [
                require('postcss-import'),
                require('cssnano')({ preset: 'default' })
              ]
            }
          },
          'sass-loader'
        ],
      },
      {
        test: /\.(png|jp(e*)g|svg)$/,
        use: [{
            loader: 'url-loader',
            options: {
                limit: 8000, // Convert images < 8kb to base64 strings
                name: 'img/[name].[hash:8].[ext]'
            }
        }]
      }
    ]
  },
  plugins: [
    new webpack.HashedModuleIdsPlugin(),
    new HtmlWebpackPlugin({
      template: 'template.html'
    }),
    new webpack.ProvidePlugin({
      '_': 'underscore',
      'Backbone': 'backbone',
      'Marionette': 'marionette',
      '$': 'jquery',
      'jQuery': 'jquery',
      'window.jQuery': 'jquery'
    }),
    new webpack.IgnorePlugin(/^\.\/locale$/, /moment$/),
    new MiniCssExtractPlugin({
      filename: '[name].[hash].css',
      chunkFilename: '[id].[hash].css'
    }),
    new CopyWebpackPlugin([
      { from: 'app/styles/img', to: 'img'}
    ]),
    // new WebpackCdnPlugin({
    //   modules: [
    //     { name: 'jquery', var: 'jQuery' }
    //   ],
    //   publicPath: '/node_modules'
    // })
  ],
  optimization: {
    runtimeChunk: 'single',
    splitChunks: {
      chunks: 'all',
      maxInitialRequests: Infinity,
      minSize: 0,
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name(module) {
            const pkgName = module.context.match(/[\\/]node_modules[\\/](.*?)([\\/]|$)/)[1];
            return `npm.${pkgName.replace('@', '')}`;
          }
        }
      }
    }
  },
  node: {
    'fs': 'empty'
  }
}
