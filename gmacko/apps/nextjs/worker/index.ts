import handler from "vinext/server/app-router-entry";
import type { ImageConfig } from "vinext/server/image-optimization";
import {
  DEFAULT_DEVICE_SIZES,
  DEFAULT_IMAGE_SIZES,
  handleImageOptimization,
} from "vinext/server/image-optimization";

interface Env {
  APP_ENV?: "development" | "staging" | "production";
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: {
          format: string;
          quality: number;
        }): Promise<{ response(): Response }>;
      };
    };
  };
  HYPERDRIVE?: {
    connectionString: string;
  };
  SHADYBANK_API_URL?: string;
  SHADYBANK_MERCHANT_TOKEN?: string;
  // Auth secrets bridged to process.env so better-auth (which reads
  // process.env at init) can see them in the Worker runtime.
  AUTH_SECRET?: string;
  OMNIAUTH_DISCOVERY_URL?: string;
  OMNIAUTH_CLIENT_ID?: string;
  OMNIAUTH_CLIENT_SECRET?: string;
  AUTH_GITHUB_ID?: string;
  AUTH_GITHUB_SECRET?: string;
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
  OMNIDAT_BOOTSTRAP_ADMINS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

const imageConfig: ImageConfig = {};

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<Response> {
    if (env.HYPERDRIVE?.connectionString) {
      process.env.DATABASE_URL = env.HYPERDRIVE.connectionString;
    }
    if (env.SHADYBANK_API_URL) {
      process.env.SHADYBANK_API_URL = env.SHADYBANK_API_URL;
    }
    if (env.SHADYBANK_MERCHANT_TOKEN) {
      process.env.SHADYBANK_MERCHANT_TOKEN = env.SHADYBANK_MERCHANT_TOKEN;
    }
    // Bridge auth secrets so better-auth sees them at init.
    for (const key of [
      "AUTH_SECRET",
      "OMNIAUTH_DISCOVERY_URL",
      "OMNIAUTH_CLIENT_ID",
      "OMNIAUTH_CLIENT_SECRET",
      "AUTH_GITHUB_ID",
      "AUTH_GITHUB_SECRET",
      "AUTH_GOOGLE_ID",
      "AUTH_GOOGLE_SECRET",
      "OMNIDAT_BOOTSTRAP_ADMINS",
    ] as const) {
      const value = env[key];
      if (value) process.env[key] = value;
    }

    const url = new URL(request.url);

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(
        request,
        {
          fetchAsset: (assetPath) =>
            env.ASSETS.fetch(new Request(new URL(assetPath, request.url))),
          transformImage: async (body, { width, format, quality }) => {
            const result = await env.IMAGES.input(body)
              .transform(width > 0 ? { width } : {})
              .output({ format, quality });
            return result.response();
          },
        },
        allowedWidths,
        imageConfig,
      );
    }

    return handler.fetch(request, env, ctx);
  },
};
