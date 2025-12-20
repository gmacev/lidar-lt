const config = {
    entry: ['src/main.tsx', 'vite.config.ts', 'eslint.config.js', 'knip.ts'],
    project: ['src/**/*.{ts,tsx}'],
    ignore: ['dist/**', 'public/**'],
    ignoreDependencies: ['potree', 'potree-core', 'tailwindcss'],
};

export default config;
