/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as auth_appIdentity from "../auth/appIdentity.js";
import type * as auth_caller from "../auth/caller.js";
import type * as auth_guards from "../auth/guards.js";
import type * as features_articles_access from "../features/articles/access.js";
import type * as features_articles_domain from "../features/articles/domain.js";
import type * as features_articles_feature from "../features/articles/feature.js";
import type * as features_articles_index from "../features/articles/index.js";
import type * as features_articles_operations from "../features/articles/operations.js";
import type * as features_articles_permissions from "../features/articles/permissions.js";
import type * as features_articles_redaction from "../features/articles/redaction.js";
import type * as features_articles_shareTokens from "../features/articles/shareTokens.js";
import type * as features_articles_visibility from "../features/articles/visibility.js";
import type * as features_index from "../features/index.js";
import type * as features_knowledgeBases_access from "../features/knowledgeBases/access.js";
import type * as features_knowledgeBases_domain from "../features/knowledgeBases/domain.js";
import type * as features_knowledgeBases_feature from "../features/knowledgeBases/feature.js";
import type * as features_knowledgeBases_index from "../features/knowledgeBases/index.js";
import type * as features_knowledgeBases_permissions from "../features/knowledgeBases/permissions.js";
import type * as features_users_feature from "../features/users/feature.js";
import type * as features_users_index from "../features/users/index.js";
import type * as features_workspaces_domain from "../features/workspaces/domain.js";
import type * as features_workspaces_feature from "../features/workspaces/feature.js";
import type * as features_workspaces_index from "../features/workspaces/index.js";
import type * as functions from "../functions.js";
import type * as http from "../http.js";
import type * as permissions_context from "../permissions/context.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  "auth/appIdentity": typeof auth_appIdentity;
  "auth/caller": typeof auth_caller;
  "auth/guards": typeof auth_guards;
  "features/articles/access": typeof features_articles_access;
  "features/articles/domain": typeof features_articles_domain;
  "features/articles/feature": typeof features_articles_feature;
  "features/articles/index": typeof features_articles_index;
  "features/articles/operations": typeof features_articles_operations;
  "features/articles/permissions": typeof features_articles_permissions;
  "features/articles/redaction": typeof features_articles_redaction;
  "features/articles/shareTokens": typeof features_articles_shareTokens;
  "features/articles/visibility": typeof features_articles_visibility;
  "features/index": typeof features_index;
  "features/knowledgeBases/access": typeof features_knowledgeBases_access;
  "features/knowledgeBases/domain": typeof features_knowledgeBases_domain;
  "features/knowledgeBases/feature": typeof features_knowledgeBases_feature;
  "features/knowledgeBases/index": typeof features_knowledgeBases_index;
  "features/knowledgeBases/permissions": typeof features_knowledgeBases_permissions;
  "features/users/feature": typeof features_users_feature;
  "features/users/index": typeof features_users_index;
  "features/workspaces/domain": typeof features_workspaces_domain;
  "features/workspaces/feature": typeof features_workspaces_feature;
  "features/workspaces/index": typeof features_workspaces_index;
  functions: typeof functions;
  http: typeof http;
  "permissions/context": typeof permissions_context;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
