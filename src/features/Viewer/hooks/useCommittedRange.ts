import { useEffect, useRef, type KeyboardEventHandler } from 'react';

const COMMIT_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

export function useCommittedRange(value: number, commit: (value: number) => void) {
    const currentValueRef = useRef(value);
    const lastCommittedValueRef = useRef(value);

    useEffect(() => {
        currentValueRef.current = value;
    }, [value]);

    const commitCurrent = () => {
        const currentValue = currentValueRef.current;
        if (Object.is(currentValue, lastCommittedValueRef.current)) return;

        lastCommittedValueRef.current = currentValue;
        commit(currentValue);
    };

    const handleKeyUp: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (COMMIT_KEYS.has(event.key)) {
            commitCurrent();
        }
    };

    return {
        onBlur: commitCurrent,
        onKeyUp: handleKeyUp,
        onPointerCancel: commitCurrent,
        onPointerUp: commitCurrent,
    };
}
