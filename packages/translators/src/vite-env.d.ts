/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SILICONFLOW_API_KEY: string;
  readonly VITE_SILICONFLOW_API_ENDPOINT: string;
  // 可以添加更多环境变量声明
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}