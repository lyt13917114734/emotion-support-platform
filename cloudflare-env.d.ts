declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    ADMIN_EXPORT_PASSWORD_HASH?: string;
  }
}

interface ImportMetaEnv {
  readonly VITE_EXPERIMENT_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
