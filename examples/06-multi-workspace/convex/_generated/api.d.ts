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
import type * as auth_agency from "../auth/agency.js";
import type * as auth_appIdentity from "../auth/appIdentity.js";
import type * as auth_caller from "../auth/caller.js";
import type * as auth_guards from "../auth/guards.js";
import type * as features_dashboard_domain from "../features/dashboard/domain.js";
import type * as features_dashboard_feature from "../features/dashboard/feature.js";
import type * as features_dashboard_index from "../features/dashboard/index.js";
import type * as features_index from "../features/index.js";
import type * as features_memberships_domain from "../features/memberships/domain.js";
import type * as features_memberships_feature from "../features/memberships/feature.js";
import type * as features_memberships_index from "../features/memberships/index.js";
import type * as features_memberships_permissions from "../features/memberships/permissions.js";
import type * as features_projects_domain from "../features/projects/domain.js";
import type * as features_projects_feature from "../features/projects/feature.js";
import type * as features_projects_index from "../features/projects/index.js";
import type * as features_projects_permissions from "../features/projects/permissions.js";
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
  "auth/agency": typeof auth_agency;
  "auth/appIdentity": typeof auth_appIdentity;
  "auth/caller": typeof auth_caller;
  "auth/guards": typeof auth_guards;
  "features/dashboard/domain": typeof features_dashboard_domain;
  "features/dashboard/feature": typeof features_dashboard_feature;
  "features/dashboard/index": typeof features_dashboard_index;
  "features/index": typeof features_index;
  "features/memberships/domain": typeof features_memberships_domain;
  "features/memberships/feature": typeof features_memberships_feature;
  "features/memberships/index": typeof features_memberships_index;
  "features/memberships/permissions": typeof features_memberships_permissions;
  "features/projects/domain": typeof features_projects_domain;
  "features/projects/feature": typeof features_projects_feature;
  "features/projects/index": typeof features_projects_index;
  "features/projects/permissions": typeof features_projects_permissions;
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
