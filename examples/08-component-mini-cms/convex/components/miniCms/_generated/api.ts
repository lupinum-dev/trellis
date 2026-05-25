/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions from "../functions.js";
import type * as features from "../features/index.js";
import type * as features_pages_domain from "../features/pages/domain.js";
import type * as features_pages_feature from "../features/pages/feature.js";
import type * as features_pages_index from "../features/pages/index.js";
import type * as features_pages_operations from "../features/pages/operations.js";
import type * as features_pages_schema from "../features/pages/schema.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";
import { anyApi, componentsGeneric } from "convex/server";

const fullApi: ApiFromModules<{
  functions: typeof functions;
  features: typeof features;
  "features/pages/domain": typeof features_pages_domain;
  "features/pages/feature": typeof features_pages_feature;
  "features/pages/index": typeof features_pages_index;
  "features/pages/operations": typeof features_pages_operations;
  "features/pages/schema": typeof features_pages_schema;
}> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
> = anyApi as any;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
> = anyApi as any;

export const components = componentsGeneric() as unknown as {};
