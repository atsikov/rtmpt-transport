const path = require("path");

module.exports = {
    target: "web",
    entry: "./src/index.js",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.js"
    },
    "mode": "development",
    module: {
        rules: [
            {
                test: /\.[jt]s/,
                use: "ts-loader",
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: [ ".ts", ".js" ]
    },
}
