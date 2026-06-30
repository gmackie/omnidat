/**
 * Type definitions for the tRPC client
 *
 * These types are re-exported from @omnidat/api for convenience.
 * If you have @omnidat/api installed as a peer dependency, you can
 * import these types directly from there for the full type definitions.
 */

// Import the AppRouter type from @omnidat/api
// This is a devDependency, so it will be available during build
// Users who want full type inference should install @omnidat/api as a peer dep
import type { AppRouter } from "@omnidat/api";
import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: string }
 */
export type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 */
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export type { AppRouter };
