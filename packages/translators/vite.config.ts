import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    esbuild: {
        minify: true,
    },
    resolve: {
        alias: {
            axios: resolve(__dirname, "node_modules/axios"),
        },
    },
    build: {
        target: "esnext",
        minify: "terser",
        lib: {
            entry: resolve(__dirname, "src/index.ts"),
            name: "translators",
            formats: ["es", "umd", "iife"],
        },
        rollupOptions: {
            external: ["axios"],
            output: {
                globals: {
                    axios: "axios",
                },
            },
        },
    },
});
