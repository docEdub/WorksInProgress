// TODO: Use webpack-merge to bring in a webpack script common to both dev and prod.
// See https://stackoverflow.com/a/53517149
const webpack = require('webpack')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin');

module.exports = {
    context: path.join(__dirname, 'app'),
    entry: {
        ['app']: path.join(__dirname, 'BabylonJs', 'app.ts'),
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    compilerOptions: {
                        "declaration": false,
                        "sourceMap": false,
                        "noImplicitAny": false,
                        "module": "esNext",
                        "target": "es5",
                        "moduleResolution": "node",
                        "importHelpers": true,
                        "experimentalDecorators": true,
                        "noImplicitReturns": true,
                        "noImplicitThis": true,
                        "noUnusedLocals": false,
                        "strictNullChecks": false,
                        "strictFunctionTypes": true,
                        "skipLibCheck": true,
                        "lib": [
                            "es5",
                            "dom",
                            "es2015.promise",
                            "es2015.collection",
                            "es2015.iterable",
                        ],
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.tsx', '.js'],
    },
    output: {
        path: path.join(__dirname, 'app'),
        publicPath: '/',
        filename: '[name].js',
        clean: true,
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(__dirname, 'BabylonJs', 'index.html'),
            filename: path.join(__dirname, 'app', 'index.html'),
        }),
    ],
    externals: {
        "babylonjs": "BABYLON",
        "./@doc.e.dub/csound-browser": "CSOUND",
    },
    performance: {
        maxAssetSize: 16384000,
    },
    optimization: {
        minimizer: [
            new TerserPlugin({
                parallel: true
            }),
        ],
    },
    devServer: {
        allowedHosts: [
            '.github.com',
        ],
        contentBase: path.join(__dirname, 'app'),
        host: '0.0.0.0',
        port: 9000,
        inline: true,
        noInfo: false,
        mimeTypes: { typeMap: { 'text/javascript': [ 'js' ] }, force: true },
        useLocalIp: true,
        watchContentBase: false,
    },
}
