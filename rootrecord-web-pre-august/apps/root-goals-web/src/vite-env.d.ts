/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOALS_API_BASE?: string;
  readonly VITE_RR_APP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
