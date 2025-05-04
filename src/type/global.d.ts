declare module "process" {
  global {
    namespace NodeJS {
      interface ProcessEnv {
        NODE_ENV?: string;
        GCP_PROJECT_ID: string;
        GCP_LOCATION: string;
      }
    }
  }
}
