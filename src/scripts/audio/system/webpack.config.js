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
		],
	},
	resolve: {
		extensions: [".ts", ".js", ],
	},
}
