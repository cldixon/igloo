import type { AppEnv } from "$server/index.js";
import type { Viewer } from "$server/auth.js";

declare global {
  namespace App {
    interface Platform {
      env: AppEnv["Bindings"];
      ctx: ExecutionContext;
    }
    interface Locals {
      db: D1Database;
      viewer: Viewer;
    }
  }
}

export {};
