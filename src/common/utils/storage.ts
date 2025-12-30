import { z } from 'zod';

/**
 * Options for creating a type-safe localStorage storage
 */
interface StorageOptions<T extends z.ZodType> {
    /** The localStorage key (will be prefixed with 'lidar:') */
    key: string;
    /** Zod schema for validation */
    schema: T;
    /** Default value if nothing is stored or validation fails */
    defaultValue: z.infer<T>;
}

/**
 * Type-safe localStorage storage with Zod validation.
 * Handles parsing, validation, and error cases gracefully.
 */
interface Storage<T> {
    /** Get the stored value, or default if not present/invalid */
    get: () => T;
    /** Set the value in localStorage */
    set: (value: T) => void;
    /** Remove the value from localStorage */
    remove: () => void;
}

/**
 * Create a type-safe localStorage storage with Zod validation.
 *
 * Features:
 * - Validates data on read (handles corrupted data gracefully)
 * - Namespaced keys with 'lidar:' prefix
 * - Error handling for quota exceeded / disabled localStorage
 *
 * @example
 * const userSettings = createStorage({
 *   key: 'user-settings',
 *   schema: z.object({ theme: z.string() }),
 *   defaultValue: { theme: 'dark' }
 * });
 *
 * userSettings.set({ theme: 'light' });
 * const settings = userSettings.get();
 */
export function createStorage<T extends z.ZodType>(
    options: StorageOptions<T>
): Storage<z.infer<T>> {
    const fullKey = `lidar:${options.key}`;

    const get = (): z.infer<T> => {
        try {
            const stored = localStorage.getItem(fullKey);
            if (stored === null) {
                return options.defaultValue;
            }

            const parsed: unknown = JSON.parse(stored);
            const result = options.schema.safeParse(parsed);

            if (result.success) {
                return result.data;
            }

            // Validation failed - log and return default
            console.warn(
                `[Storage] Invalid data for key "${fullKey}", using default:`,
                result.error.issues
            );
            return options.defaultValue;
        } catch (error) {
            // JSON parse failed or localStorage not available
            console.warn(`[Storage] Error reading key "${fullKey}":`, error);
            return options.defaultValue;
        }
    };

    const set = (value: z.infer<T>): void => {
        try {
            const serialized = JSON.stringify(value);
            localStorage.setItem(fullKey, serialized);
        } catch (error) {
            // Quota exceeded or localStorage disabled
            console.error(`[Storage] Error writing key "${fullKey}":`, error);
        }
    };

    const remove = (): void => {
        try {
            localStorage.removeItem(fullKey);
        } catch (error) {
            console.error(`[Storage] Error removing key "${fullKey}":`, error);
        }
    };

    return { get, set, remove };
}

/**
 * Create a storage that stores an array of items, with helper methods.
 */
interface ArrayStorageOptions<T extends z.ZodType> extends StorageOptions<z.ZodArray<T>> {
    /** Schema for individual items (not the array) */
    itemSchema: T;
}

interface ArrayStorage<T> extends Storage<T[]> {
    /** Add an item to the array */
    add: (item: T) => void;
    /** Remove an item by predicate */
    removeWhere: (predicate: (item: T) => boolean) => void;
    /** Update an item by predicate */
    updateWhere: (predicate: (item: T) => boolean, updater: (item: T) => T) => void;
}

/**
 * Create a type-safe array storage with convenience methods.
 */
export function createArrayStorage<T extends z.ZodType>(
    options: ArrayStorageOptions<T>
): ArrayStorage<z.infer<T>> {
    const baseStorage = createStorage(options);

    const add = (item: z.infer<T>): void => {
        const current = baseStorage.get();
        baseStorage.set([...current, item]);
    };

    const removeWhere = (predicate: (item: z.infer<T>) => boolean): void => {
        const current = baseStorage.get();
        baseStorage.set(current.filter((item: z.infer<T>) => !predicate(item)));
    };

    const updateWhere = (
        predicate: (item: z.infer<T>) => boolean,
        updater: (item: z.infer<T>) => z.infer<T>
    ): void => {
        const current = baseStorage.get();
        baseStorage.set(
            current.map((item: z.infer<T>) => (predicate(item) ? updater(item) : item))
        );
    };

    return {
        ...baseStorage,
        add,
        removeWhere,
        updateWhere,
    };
}
