/**
 * Type definitions for the tRPC client
 *
 * Generic tRPC inference helpers.
 *
 * Import `AppRouter` from @omnidat/api and pass it to these helpers when you
 * need application-specific input and output inference.
 */

import type {
  AnyTRPCRouter,
  inferRouterInputs,
  inferRouterOutputs,
} from "@trpc/server";

/**
 * Inference helpers for input types
 * @example
 * type PostByIdInput = RouterInputs['post']['byId']
 *      ^? { id: string }
 */
export type RouterInputs<TRouter extends AnyTRPCRouter> =
  inferRouterInputs<TRouter>;

/**
 * Inference helpers for output types
 * @example
 * type AllPostsOutput = RouterOutputs['post']['all']
 *      ^? Post[]
 */
export type RouterOutputs<TRouter extends AnyTRPCRouter> =
  inferRouterOutputs<TRouter>;
