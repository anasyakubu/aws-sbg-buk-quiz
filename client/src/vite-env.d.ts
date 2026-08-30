/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the deployed API, e.g. https://sbg-buk-quiz-api.vercel.app. Empty in dev. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
