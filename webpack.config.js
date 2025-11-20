const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const HtmlInlineScriptPlugin = require('html-inline-script-webpack-plugin');

module.exports = {
    mode: 'production',
    entry: {
        ui: './src/ui.ts',
        code: './src/code.ts',
    },
    module: {
        rules: [{ test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ }],
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    output: {
        path: path.resolve(__dirname, 'dist'),
        filename: '[name].js',
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/ui.html',
            filename: 'ui.html',
            chunks: ['ui'],
            cache: false,
        }),
        new HtmlInlineScriptPlugin(),
    ],
};
