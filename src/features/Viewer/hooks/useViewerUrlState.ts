import { useEffect, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import debounce from 'lodash/debounce';
import type { ViewerState } from '@/features/Viewer/config/viewerConfig';
import { Route } from '@/routes/viewer.$cellId';

interface UseViewerUrlStateOptions {
    cellId: string;
    initialState: ViewerState;
}

export function useViewerUrlState({ cellId, initialState }: UseViewerUrlStateOptions) {
    const navigate = useNavigate({ from: Route.fullPath });
    const [sidebarResetKey, setSidebarResetKey] = useState(0);
    const [resetSidebarInitialState, setResetSidebarInitialState] = useState<{
        cellId: string;
        state: ViewerState;
    } | null>(null);
    const sidebarInitialState =
        resetSidebarInitialState?.cellId === cellId ? resetSidebarInitialState.state : initialState;

    const updateUrlDebounced = debounce((state: Partial<ViewerState>) => {
        void navigate({
            search: (prev) => ({ ...prev, ...state }),
            replace: true,
        });
    }, 500);

    const updateUrl = (state: Partial<ViewerState>) => {
        setResetSidebarInitialState((current) =>
            current?.cellId === cellId
                ? {
                      cellId,
                      state: {
                          ...current.state,
                          ...state,
                      },
                  }
                : current
        );

        void navigate({
            search: (prev) => ({ ...prev, ...state }),
            replace: true,
        });
    };

    useEffect(() => {
        return () => {
            updateUrlDebounced.cancel();
        };
    }, [updateUrlDebounced]);

    const setSidebarInitialState = (state: ViewerState) => {
        setResetSidebarInitialState({ cellId, state });
    };

    const bumpSidebarResetKey = () => {
        setSidebarResetKey((value) => value + 1);
    };

    return {
        updateUrl,
        updateUrlDebounced,
        sidebarInitialState,
        sidebarResetKey,
        setSidebarInitialState,
        bumpSidebarResetKey,
    };
}
