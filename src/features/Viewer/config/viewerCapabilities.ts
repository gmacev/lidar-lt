export const VIEWER_CAPABILITIES = {
    // Temporary permission gate. Production rollout should only require changing this value
    // and serving the existing app-local provider path from the production reverse proxy.
    orthophotoCompare: import.meta.env.DEV,
} as const;
