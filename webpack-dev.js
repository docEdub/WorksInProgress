// TODO: Use webpack-merge to bring in a webpack script common to both dev and prod.
// See https://stackoverflow.com/a/53517149
const webpack = require('webpack')
const path = require('path')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
    context: path.join(__dirname, 'app-dev'),
    entry: {
        ['app']: path.join(__dirname, 'BabylonJs', 'app.ts'),
        ['audio-3dof']: path.join(__dirname, 'BabylonJs', 'audio-3dof.ts'),
        ['audio-6dof']: path.join(__dirname, 'BabylonJs', 'audio-6dof.ts'),
        ['audio-daw']: path.join(__dirname, 'BabylonJs', 'audio-daw.ts'),
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    compilerOptions: {
                        "declaration": false,
                        "sourceMap": true,
                        "noImplicitAny": false,
                        "module": "esNext",
                        "target": "es2015",
                        "moduleResolution": "node",
                        "importHelpers": true,
                        "experimentalDecorators": true,
                        "noImplicitReturns": true,
                        "noImplicitThis": true,
                        "noUnusedLocals": false,
                        "resolveJsonModule": true,
                        "strictNullChecks": false,
                        "strictFunctionTypes": true,
                        "skipLibCheck": true,
                        "lib": [
                            "es2015",
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
        extensions: [ '.ts', '.tsx', '.js' ],
    },
    output: {
        clean: true,
        filename: '[name].js',
        path: path.join(__dirname, 'app-dev'),
        publicPath: '/',
    },
    plugins: [
        new CopyWebpackPlugin({
            patterns: [
                {
                    from: path.join(__dirname, 'BabylonJs', 'index-dev.html'),
                    to: path.join(__dirname, 'app-dev', 'index.html')
                },
                {
                    from: path.join(__dirname, 'Csound', 'build', 'bounce', 'mixdown', 'normalized-wy.mp3'),
                    to: path.join(__dirname, 'app-dev', 'assets', 'normalized-wy.mp3')
                },
                {
                    from: path.join(__dirname, 'Csound', 'build', 'bounce', 'mixdown', 'normalized-zx.mp3'),
                    to: path.join(__dirname, 'app-dev', 'assets', 'normalized-zx.mp3')
                }
            ]
        }),
        new webpack.HotModuleReplacementPlugin(),
    ],
    externals: {
        "babylonjs": "BABYLON",
        "./@doc.e.dub/csound-browser": "CSOUND",
        "omnitone": "Omnitone",
    },
    performance: {
        hints: false,
    },
    devServer: {
        allowedHosts: [
            '.github.com',
        ],
        contentBase: path.join(__dirname, 'app-dev'),
        host: '0.0.0.0', port: 8081,
        inline: true,
        noInfo: false,
        mimeTypes: { typeMap: { 'text/javascript': [ 'js' ] }, force: true },
        useLocalIp: true,
        watchContentBase: true,
    },
}
