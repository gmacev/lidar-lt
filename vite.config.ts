import { defineConfig } from 'vite';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import react, { reactCompilerPreset } from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import babel from '@rolldown/plugin-babel';
import path from 'path';

export default defineConfig({
    plugins: [
        tanstackRouter(),
        tailwindcss(),
        react(),
        babel({
            presets: [reactCompilerPreset()],
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
        include: ['maplibre-gl', '@mapbox/vector-tile', 'pbf', 'three', 'lodash'],
    },

    // Allow access from other devices on the network
    server: {
        host: true,
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
