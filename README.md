# 🛰️ LiDAR Lithuania

An interactive web application for exploring Lithuania's LiDAR point cloud data from [geoportal.lt](https://www.geoportal.lt/).

## Features

- **Grid-based navigation** – Select sectors from an interactive map of Lithuania
- **3D point cloud viewer** – Powered by Potree with orbit camera controls
- **Visualization modes** – Elevation coloring, intensity, return number
- **Classification filtering** – Show/hide ground, vegetation, buildings, etc.
- **Measurement tools** – Distance, area, angle, azimuth, circle, volume, and height profile
- **Flood simulation** – Water level visualization across terrain
- **URL persistence** – Shareable links with camera position and settings

## Tech Stack

- **React 19** with React Compiler
- **TypeScript** (strict mode)
- **Vite** for bundling
- **TanStack Router** for routing
- **MapLibre GL** for the grid map
- **Potree** for point cloud rendering
- **Tailwind CSS** for styling

## Getting Started

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Preview production build
npm run serve
```

## Generated assets

The map uses a checked-in dark OpenFreeMap style so production startup does not transform and reload the style at runtime. Regenerate it deliberately when updating the upstream Liberty style:

```bash
npm run generate:map-style
```

Grid coordinates are stored at six decimal places, which is sufficient for the map resolution and reduces the production bundle. Run the structural GeoJSON optimizer after replacing the source grid:

```bash
npm run optimize:grid
```

## Project Structure

```
src/
├── common/          # Shared components, utilities and types
├── features/        # Feature modules
│   ├── GridMap/     # Sector selection map
│   └── Viewer/      # Point cloud viewer
└── routes/          # TanStack Router pages
```

## Data Source

Point cloud data is sourced from the Lithuanian Spatial Information Portal ([geoportal.lt](https://www.geoportal.lt/)). Raw LAZ files are processed with PDAL and converted with Potree Converter to a format for web visualization.

## License

MIT
