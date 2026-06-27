import { useEffect, useRef, type RefObject } from 'react';
import type { PotreeScene, PotreeViewer } from '@/common/types/potree';

interface UseKeyboardCameraNavigationOptions {
    enabled?: boolean;
    onInteraction?: () => void;
    viewerRef: RefObject<PotreeViewer | null>;
}

const FORWARD_KEYS = new Set(['ArrowUp', 'KeyW']);
const BACKWARD_KEYS = new Set(['ArrowDown', 'KeyS']);
const LEFT_KEYS = new Set(['ArrowLeft', 'KeyA']);
const RIGHT_KEYS = new Set(['ArrowRight', 'KeyD']);
const ROTATE_LEFT_KEYS = new Set(['KeyQ']);
const ROTATE_RIGHT_KEYS = new Set(['KeyE']);
const NAVIGATION_KEYS = new Set([
    ...FORWARD_KEYS,
    ...BACKWARD_KEYS,
    ...LEFT_KEYS,
    ...RIGHT_KEYS,
    ...ROTATE_LEFT_KEYS,
    ...ROTATE_RIGHT_KEYS,
]);

const MOVEMENT_SPEED_PER_RADIUS = 0.6;
const ROTATION_SPEED_RADIANS = Math.PI / 6;
const FAST_SPEED_MULTIPLIER = 2;
const MINIMUM_REFERENCE_RADIUS = 10;
const MAXIMUM_FRAME_SECONDS = 0.05;

function isInteractiveTarget(target: EventTarget | null) {
    return (
        target instanceof Element &&
        target.closest(
            'a, button, input, select, textarea, [contenteditable], [role="slider"], [role="textbox"]'
        ) !== null
    );
}

function hasAnyKey(pressedKeys: Set<string>, keys: Set<string>) {
    for (const key of keys) {
        if (pressedKeys.has(key)) return true;
    }

    return false;
}

function orbitView(view: PotreeScene['view'], rotationRadians: number) {
    const pivot = view.getPivot();
    const nextYaw = view.yaw + rotationRadians;
    const cosPitch = Math.cos(view.pitch);
    const sinPitch = Math.sin(view.pitch);
    const sinYaw = Math.sin(nextYaw);
    const cosYaw = Math.cos(nextYaw);

    view.yaw = nextYaw;
    view.position.set(
        pivot.x + cosPitch * sinYaw * view.radius,
        pivot.y - cosPitch * cosYaw * view.radius,
        pivot.z - sinPitch * view.radius
    );
}

/**
 * Navigates the Potree camera while Arrow, WASD, Q, or E keys are held.
 * Movement follows the current camera heading, rotation orbits the current pivot,
 * and holding Shift doubles both speeds.
 */
export function useKeyboardCameraNavigation({
    enabled = true,
    onInteraction,
    viewerRef,
}: UseKeyboardCameraNavigationOptions) {
    const onInteractionRef = useRef(onInteraction);

    useEffect(() => {
        onInteractionRef.current = onInteraction;
    }, [onInteraction]);

    useEffect(() => {
        if (!enabled) return;

        const pressedKeys = new Set<string>();
        let animationFrame: number | null = null;
        let previousFrameTime: number | null = null;
        let speedMultiplier = 1;

        const stopNavigation = () => {
            pressedKeys.clear();
            previousFrameTime = null;
            speedMultiplier = 1;

            if (animationFrame !== null) {
                cancelAnimationFrame(animationFrame);
                animationFrame = null;
            }
        };

        const moveCamera = (frameTime: number) => {
            animationFrame = null;

            const viewer = viewerRef.current;
            if (!viewer || pressedKeys.size === 0) {
                previousFrameTime = null;
                return;
            }

            const previousTime = previousFrameTime ?? frameTime;
            const elapsedSeconds = Math.min(
                (frameTime - previousTime) / 1000,
                MAXIMUM_FRAME_SECONDS
            );
            previousFrameTime = frameTime;

            const forward =
                Number(hasAnyKey(pressedKeys, FORWARD_KEYS)) -
                Number(hasAnyKey(pressedKeys, BACKWARD_KEYS));
            const right =
                Number(hasAnyKey(pressedKeys, RIGHT_KEYS)) -
                Number(hasAnyKey(pressedKeys, LEFT_KEYS));
            const rotation =
                Number(hasAnyKey(pressedKeys, ROTATE_LEFT_KEYS)) -
                Number(hasAnyKey(pressedKeys, ROTATE_RIGHT_KEYS));
            const inputLength = Math.hypot(forward, right);
            const view = viewer.scene.view;

            if (rotation !== 0 && elapsedSeconds > 0) {
                orbitView(
                    view,
                    rotation * ROTATION_SPEED_RADIANS * speedMultiplier * elapsedSeconds
                );
            }

            if (inputLength > 0 && elapsedSeconds > 0) {
                const distance =
                    Math.max(view.radius, MINIMUM_REFERENCE_RADIUS) *
                    MOVEMENT_SPEED_PER_RADIUS *
                    speedMultiplier *
                    elapsedSeconds;
                const normalizedForward = forward / inputLength;
                const normalizedRight = right / inputLength;
                const sinYaw = Math.sin(view.yaw);
                const cosYaw = Math.cos(view.yaw);

                const deltaX = (-sinYaw * normalizedForward + cosYaw * normalizedRight) * distance;
                const deltaY = (cosYaw * normalizedForward + sinYaw * normalizedRight) * distance;

                view.position.set(
                    view.position.x + deltaX,
                    view.position.y + deltaY,
                    view.position.z
                );
            }

            animationFrame = requestAnimationFrame(moveCamera);
        };

        const handleKeyDown = (event: KeyboardEvent) => {
            speedMultiplier = event.shiftKey ? FAST_SPEED_MULTIPLIER : 1;

            if (
                !NAVIGATION_KEYS.has(event.code) ||
                event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                isInteractiveTarget(event.target)
            ) {
                return;
            }

            event.preventDefault();

            const wasIdle = pressedKeys.size === 0;
            pressedKeys.add(event.code);

            if (wasIdle) {
                onInteractionRef.current?.();
                animationFrame = requestAnimationFrame(moveCamera);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            speedMultiplier = event.shiftKey ? FAST_SPEED_MULTIPLIER : 1;
            if (!NAVIGATION_KEYS.has(event.code)) return;

            pressedKeys.delete(event.code);
            if (pressedKeys.size === 0) {
                stopNavigation();
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) stopNavigation();
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('blur', stopNavigation);
        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            stopNavigation();
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('blur', stopNavigation);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [enabled, viewerRef]);
}
