/**
 * Screen size utilities for responsive behavior
 * Uses Tailwind's breakpoint values (sm: 640px, md: 768px, lg: 1024px, xl: 1280px)
 */

export const BREAKPOINTS = {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
} as const;

/**
 * Check if the current window width is below a given breakpoint.
 */
export function isBelowBreakpoint(breakpoint: keyof typeof BREAKPOINTS): boolean {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < BREAKPOINTS[breakpoint];
}

/**
 * Check if we're on a mobile-sized screen (< sm breakpoint, 640px)
 */
export function isMobile(): boolean {
    return isBelowBreakpoint('sm');
}

/**
 * Check if we're on a small screen (< md breakpoint, 768px)
 */
export function isSmallScreen(): boolean {
    return isBelowBreakpoint('md');
}

/**
 * Check if the device has touch capability.
 * Uses multiple detection methods for broader browser support.
 */
export function isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;

    return (
        'ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        // @ts-expect-error - msMaxTouchPoints is IE/Edge specific
        navigator.msMaxTouchPoints > 0
    );
}
