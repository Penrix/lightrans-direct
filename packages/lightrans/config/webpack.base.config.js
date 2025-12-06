const path = require("path");
const webpack = require("webpack");

// Load environment variables from root directory .env.local file using Node.js built-in fs module
let env = {};
try {
  const fs = require('fs');
  const envPath = path.resolve(__dirname, "../../../.env.local");
  console.log(`Attempting to read env file from: ${envPath}`);
  
  // Read .env.local file content
  const envFileContent = fs.readFileSync(envPath, 'utf8');
  
  // Parse environment variables
  envFileContent.split('\n').forEach(line => {
    // Ignore empty lines and comments
    if (line.trim() && !line.startsWith('#')) {
      // Split key-value pairs
      const [key, value] = line.split('=').map(part => part.trim());
      if (key && value) {
        env[key] = value;
      }
    }
  });
  
  console.log(`Successfully loaded ${Object.keys(env).length} environment variables from ${envPath}`);
} catch (error) {
  console.log(`Error reading env file: ${error.message}`);
  console.log('Using empty environment variables');
}

// Convert environment variables for webpack DefinePlugin
const envKeys = Object.keys(env).reduce((prev, next) => {
  prev[`process.env.${next}`] = JSON.stringify(env[next]);
  prev[`import.meta.env.${next}`] = JSON.stringify(env[next]);
  return prev;
}, {});

module.exports = {
    entry: {
        "/background/background": "./src/background/background.js",
        "/content/pdf": "./src/content/pdf.js",
        "/content/banner_controller": "./src/content/banner_controller.js",
        "/content/select/select": "./src/content/select/select.js",
        "/content/display/display": "./src/content/display/index.js",
        "/content/notice/notice": "./src/content/notice/notice.js",
        "/popup/popup": "./src/popup/popup.js",
        "/options/options": "./src/options/options.js",
        "/content/deepl_injector": "./src/content/deepl_injector.js",
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "../build"),
        publicPath: "./",
    },
    module: {
        rules: [
            {
                test: /\.jsx?$/,
                exclude: /(node_modules)/,
                use: {
                    loader: "babel-loader",
                },
            },
            {
                test: [/\.css$/],
                use: "raw-loader",
            },
            {
                test: [/\.svg$/],
                loader: "@svgr/webpack",
                options: {
                    titleProp: true,
                },
            },
        ],
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "../src"),
            common: path.resolve(__dirname, "../src/common"),
            react: "preact/compat",
            "react-dom/test-utils": "preact/test-utils",
            "react-dom": "preact/compat",
            "@lightrans/translators": path.resolve(__dirname, "../../translators"),
        },
        fallback: {
            path: false,
            fs: false,
            stream: false,
        },
    },
    performance: {
        hints: false,
    },
    plugins: [
        new webpack.DefinePlugin(envKeys),
    ],
};
