/// <reference types="vite/client" />

/**
 * Vite `import.meta.env` for build-time API URL and optional Superset embed IDs.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  /** Public origin where the browser loads Superset (e.g. https://localhost:18443/superset). Defaults to `${origin}/superset`. */
  readonly VITE_SUPERSET_ORIGIN?: string;
  /** Superset dashboard UUID (Embed dashboard dialog in Superset UI). Required for embedded view. */
  readonly VITE_SUPERSET_DASHBOARD_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
