const path = require('path');
const nodeExternals = require('webpack-node-externals');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const NodemonPlugin = require('nodemon-webpack-plugin');

module.exports = (env, argv) => {
    const isDevelopment = argv.mode === 'development';

    return {
        target: 'node',
        mode: argv.mode || 'development',
        entry: './src/index.ts',
        output: {
            path: path.resolve(__dirname, 'dist'),
            filename: 'server.js',
            clean: true,
        },
        devtool: isDevelopment ? 'eval-source-map' : 'source-map',
        resolve: {
            extensions: ['.ts', '.tsx', '.js'],
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: {
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true,
                            configFile: path.resolve(__dirname, './tsconfig.json'),
                        },
                    },
                    exclude: /node_modules/,
                },
            ],
        },
        externals: [nodeExternals()],
        plugins: [
            new CleanWebpackPlugin(),
            new ForkTsCheckerWebpackPlugin({
                typescript: {
                    configFile: path.resolve(__dirname, './tsconfig.json'),
                },
            }),
            ...(isDevelopment
                ? [
                      new NodemonPlugin({
                          script: './dist/server.js',
                          watch: ['./dist'],
                          ext: 'js',
                          delay: '1000',
                      }),
                  ]
                : []),
        ],
        optimization: {
            moduleIds: 'deterministic',
            splitChunks: {
                chunks: 'all',
            },
        },
        watch: isDevelopment,
    };
};
