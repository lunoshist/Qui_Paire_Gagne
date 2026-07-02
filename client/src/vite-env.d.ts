/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base HTTP de l'API (défaut local : http://localhost:8787). */
  readonly VITE_API_URL?: string;
  /** Base WebSocket du Worker (défaut local : ws://localhost:8787). */
  readonly VITE_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
