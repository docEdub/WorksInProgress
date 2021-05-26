// TODO: Use webpack-merge to bring in a webpack script common to both dev and prod.
// See https://stackoverflow.com/a/53517149
const webpack = require('webpack')
const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const config = require(path.join(__dirname, 'config'))

console.log("\n======================================================================================================")
console.log("")
console.log("config.rootSourcePath = " + config.rootSourcePath)
console.log("config.rootOutputPath = " + config.rootOutputPath)
console.log("")
console.log("config.projectSourcePath = " + config.projectSourcePath)
console.log("config.projectOutputPath = " + config.projectOutputPath)
console.log("")
console.log("======================================================================================================\n")

module.exports = {
    context: config.projectSourcePath,
    entry: {
        [path.join(config.relativeProjectOutputPath, 'index')]: path.join(config.projectSourcePath, 'index.ts'),
    },
    devtool: 'source-map',
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
                        "noImplicitAny": true,
                        "module": "esNext",
                        "target": "es5",
                        "jsx": "react",
                        "moduleResolution": "node",
                        "importHelpers": true,
                        "experimentalDecorators": true,
                        "noImplicitReturns": true,
                        "noImplicitThis": true,
                        "noUnusedLocals": true,
                        "strictNullChecks": true,
                        "strictFunctionTypes": true,
                        "skipLibCheck": true,
                        "lib": [
                            "es5",
                            "dom",
                            "es2015.promise",
                            "es2015.collection",
                            "es2015.iterable"
                        ],
                    }
                }
            }
        ]
    },
    resolve: {
        extensions: [ '.ts', '.tsx', '.js' ]
    },
    output: {
        path: config.rootOutputPath,
        publicPath: '/',
        filename: '[name].js',
    },
    plugins: [
        new webpack.HotModuleReplacementPlugin(),
        new HtmlWebpackPlugin({
            template: path.join(config.projectSourcePath, 'index.html'),
            filename: path.join(config.projectOutputPath, 'index.html'),
        })
    ],
    externals: {
        "babylonjs": "BABYLON",
    },
    performance: {
        maxAssetSize: 16384000
    },
    devServer: {
        allowedHosts: [
            '.github.com',
        ],
        before(app, server) {
            server._watch(path.join(config.projectSourcePath, '**'))
        },
        contentBase: [config.rootOutputPath],
        host: '0.0.0.0',
        port: 9000,
        hot: true,
        inline: true,
        noInfo: false,
        mimeTypes: { typeMap: { 'text/javascript': [ 'js' ] }, force: true },
        useLocalIp: true,
        watchContentBase: true,
    }
}
