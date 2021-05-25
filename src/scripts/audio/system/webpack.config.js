const path = require("path")

module.exports = {
  target: "node",
  mode: "production",
  entry: {
    main: path.resolve(__dirname, "./src/script.ts"),
  },
  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "index.js",
    library: {
      name: "system",
      type: "umd",
    },
  },
  optimization: {
    minimize: false,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: ["ts-loader", ],
      },
      {
        test: /\.node/,
        type: "asset/resource",
        generator: {
          filename: content => {
            const base = content.module.rawRequest
              .split("/")
              .slice(1)
              .join("/");

            const full = "../" + base;
            return full;
          },
        },
      },
    ],
  },
}
