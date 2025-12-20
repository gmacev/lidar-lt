import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
    plugins: [
        tanstackRouter(),
        tailwindcss(),
        react({
            babel: {
                plugins: [['babel-plugin-react-compiler', {}]],
            },
        }),
    ],

    // Path aliases
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },

    // Optimize dependency pre-bundling for faster dev startup
    optimizeDeps: {
        include: ['maplibre-gl', 'three', 'lodash'],
    },

    build: {
        // Target modern browsers for smaller output
        target: 'esnext',

        // Disable sourcemaps in production for faster builds
        sourcemap: false,

        // Inline small assets as base64 (< 4KB)
        assetsInlineLimit: 4096,
    },
});
