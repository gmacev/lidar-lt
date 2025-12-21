import type { SVGProps, ReactNode } from 'react';

/**
 * Icon definitions - each icon is a function that returns the SVG content.
 * This allows for proper typing and keeps the component clean.
 */
const icons = {
    // Navigation & UI
    chevronDown: () => <path d="M6 9l6 6 6-6" />,
    chevronUp: () => <path d="M18 15l-6-6-6 6" />,
    chevronRight: () => <path d="M9 18l6-6-6-6" />,
    chevronLeft: () => <path d="M15 18l-6-6 6-6" />,
    arrowLeft: () => <path d="M19 12H5m7 7-7-7 7-7" />,
    close: () => (
        <>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
        </>
    ),
    plus: () => (
        <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </>
    ),
    minus: () => <line x1="5" y1="12" x2="19" y2="12" />,
    check: () => <polyline points="20 6 9 17 4 12" />,

    // Visibility
    eye: () => (
        <>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    eyeOff: () => (
        <>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
        </>
    ),

    // Measurement
    ruler: () => (
        <>
            <path d="M21.3 8.7 8.7 21.3c-1 1-2.5 1-3.4 0l-2.6-2.6c-1-1-1-2.5 0-3.4L15.3 2.7c1-1 2.5-1 3.4 0l2.6 2.6c1 1 1 2.5 0 3.4Z" />
            <path d="m7.5 10.5 2 2" />
            <path d="m10.5 7.5 2 2" />
            <path d="m13.5 4.5 2 2" />
            <path d="m4.5 13.5 2 2" />
        </>
    ),
    map: () => <path d="M3 7l6-3 6 3 6-3v13l-6 3-6-3-6 3V7z" />,
    activity: () => <path d="M22 12h-4l-3 9L9 3l-3 9H2" />,
    angle: () => (
        <>
            <path d="M5 19h14" />
            <path d="M5 19V5" />
            <path d="M5 12a7 7 0 0 1 7 0" />
        </>
    ),

    // Weather & Environment
    sun: () => (
        <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2" />
            <path d="M12 20v2" />
            <path d="m4.93 4.93 1.41 1.41" />
            <path d="m17.66 17.66 1.41 1.41" />
            <path d="M2 12h2" />
            <path d="M20 12h2" />
            <path d="m6.34 17.66-1.41 1.41" />
            <path d="m19.07 4.93-1.41 1.41" />
        </>
    ),
    waves: () => (
        <>
            <path d="M2 12c.6.5 1.2 1 2.5 1C7 13 7 11 9.5 11c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            <path d="M2 17c.6.5 1.2 1 2.5 1C7 18 7 16 9.5 16c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
            <path d="M2 7c.6.5 1.2 1 2.5 1C7 8 7 6 9.5 6c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
        </>
    ),

    // Location
    mapPin: () => (
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    ),

    // Sidebar icons
    palette: () => (
        <path d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
    ),
    tag: () => (
        <path d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
    ),
    sparkles: () => (
        <path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    ),
} as const;

/** All available icon names */
export type IconName = keyof typeof icons;

/** Props for the Icon component */
interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
    /** Name of the icon to render */
    name: IconName;
    /** Size of the icon (width and height). Can be number (px) or string (any CSS value) */
    size?: number | string;
    /** Stroke width for outlined icons */
    strokeWidth?: number | string;
    /** Fill color (use 'currentColor' to inherit from text color) */
    fill?: string;
    /** Stroke color (use 'currentColor' to inherit from text color) */
    stroke?: string;
}

/**
 * Reusable, type-safe Icon component.
 *
 * @example
 * // Basic usage
 * <Icon name="eye" />
 *
 * // With size
 * <Icon name="ruler" size={24} />
 *
 * // With custom styling
 * <Icon name="sun" className="text-neon-amber" strokeWidth={2.5} />
 *
 * // Filled icon (like map pin)
 * <Icon name="mapPin" fill="currentColor" stroke="none" />
 */
export function Icon({
    name,
    size = 20,
    strokeWidth = 2,
    fill = 'none',
    stroke = 'currentColor',
    className,
    ...svgProps
}: IconProps): ReactNode {
    const iconContent = icons[name];

    // Determine width/height from size
    const dimension = typeof size === 'number' ? size : undefined;
    const style = typeof size === 'string' ? { width: size, height: size } : undefined;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={dimension ?? 20}
            height={dimension ?? 20}
            viewBox="0 0 24 24"
            fill={fill}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            style={style}
            {...svgProps}
        >
            {iconContent()}
        </svg>
    );
}
