import { defineConfig } from "vite";
import { resolve } from "path";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
    // Load environment variables from the project root's .env.local file
    const env = loadEnv(mode, resolve(__dirname, '../..'), 'VITE_');
    
    return {
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
        define: {
            'import.meta.env.VITE_SILICONFLOW_API_KEY': JSON.stringify(env.VITE_SILICONFLOW_API_KEY || ''),
            'import.meta.env.VITE_SILICONFLOW_API_ENDPOINT': JSON.stringify(env.VITE_SILICONFLOW_API_ENDPOINT || 'https://api.siliconflow.cn/v1/chat/completions'),
        },
    };
});