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
import type * as features_comments_domain from "../features/comments/domain.js";
import type * as features_comments_feature from "../features/comments/feature.js";
import type * as features_comments_index from "../features/comments/index.js";
import type * as features_comments_permissions from "../features/comments/permissions.js";
import type * as features_files_domain from "../features/files/domain.js";
import type * as features_files_feature from "../features/files/feature.js";
import type * as features_files_index from "../features/files/index.js";
import type * as features_index from "../features/index.js";
import type * as features_members_domain from "../features/members/domain.js";
import type * as features_members_feature from "../features/members/feature.js";
import type * as features_members_index from "../features/members/index.js";
import type * as features_projects_domain from "../features/projects/domain.js";
import type * as features_projects_feature from "../features/projects/feature.js";
import type * as features_projects_index from "../features/projects/index.js";
import type * as features_projects_operations from "../features/projects/operations.js";
import type * as features_projects_permissions from "../features/projects/permissions.js";
import type * as features_tasks_checks from "../features/tasks/checks.js";
import type * as features_tasks_domain from "../features/tasks/domain.js";
import type * as features_tasks_feature from "../features/tasks/feature.js";
import type * as features_tasks_index from "../features/tasks/index.js";
import type * as features_tasks_operations from "../features/tasks/operations.js";
import type * as features_tasks_permissions from "../features/tasks/permissions.js";
import type * as features_tasks_recordAccess from "../features/tasks/recordAccess.js";
import type * as features_tasks_webhooks from "../features/tasks/webhooks.js";
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
  "features/comments/domain": typeof features_comments_domain;
  "features/comments/feature": typeof features_comments_feature;
  "features/comments/index": typeof features_comments_index;
  "features/comments/permissions": typeof features_comments_permissions;
  "features/files/domain": typeof features_files_domain;
  "features/files/feature": typeof features_files_feature;
  "features/files/index": typeof features_files_index;
  "features/index": typeof features_index;
  "features/members/domain": typeof features_members_domain;
  "features/members/feature": typeof features_members_feature;
  "features/members/index": typeof features_members_index;
  "features/projects/domain": typeof features_projects_domain;
  "features/projects/feature": typeof features_projects_feature;
  "features/projects/index": typeof features_projects_index;
  "features/projects/operations": typeof features_projects_operations;
  "features/projects/permissions": typeof features_projects_permissions;
  "features/tasks/checks": typeof features_tasks_checks;
  "features/tasks/domain": typeof features_tasks_domain;
  "features/tasks/feature": typeof features_tasks_feature;
  "features/tasks/index": typeof features_tasks_index;
  "features/tasks/operations": typeof features_tasks_operations;
  "features/tasks/permissions": typeof features_tasks_permissions;
  "features/tasks/recordAccess": typeof features_tasks_recordAccess;
  "features/tasks/webhooks": typeof features_tasks_webhooks;
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
