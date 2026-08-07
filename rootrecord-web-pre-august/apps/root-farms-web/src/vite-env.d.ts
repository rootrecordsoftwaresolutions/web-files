/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ROOTRECORD_API_ORIGIN?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_ROOT_FARMS_SLOT?: string;
  readonly VITE_ADSENSE_ROOT_FARMS_TOP_SLOT?: string;
  readonly VITE_ADSENSE_ROOT_FARMS_BOTTOM_SLOT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
