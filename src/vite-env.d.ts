/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PREDICT_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
