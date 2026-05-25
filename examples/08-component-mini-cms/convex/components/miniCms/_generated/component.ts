/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    pages: {
      createPage: FunctionReference<
        "mutation",
        "internal",
        {
          draftBody?: string;
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
          slug: string;
          title: string;
        },
        string,
        Name
      >;
      getPublishedPage: FunctionReference<
        "query",
        "internal",
        {
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
          slug: string;
        },
        {
          _id: string;
          authorId: string;
          body: string;
          publishedAt: number | null;
          slug: string;
          status: "draft" | "published";
          title: string;
          updatedAt: number;
        } | null,
        Name
      >;
      listDraftPages: FunctionReference<
        "query",
        "internal",
        {
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
        },
        Array<{
          _id: string;
          authorId: string;
          draftBody: string;
          publishedAt: number | null;
          publishedBody: string;
          slug: string;
          status: "draft" | "published";
          title: string;
          updatedAt: number;
        }>,
        Name
      >;
      listPublishedPages: FunctionReference<
        "query",
        "internal",
        {
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
        },
        Array<{
          _id: string;
          authorId: string;
          body: string;
          publishedAt: number | null;
          slug: string;
          status: "draft" | "published";
          title: string;
          updatedAt: number;
        }>,
        Name
      >;
      listStudioPages: FunctionReference<
        "query",
        "internal",
        {
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
        },
        Array<{
          _id: string;
          authorId: string;
          draftBody: string;
          publishedAt: number | null;
          publishedBody: string;
          slug: string;
          status: "draft" | "published";
          title: string;
          updatedAt: number;
        }>,
        Name
      >;
      previewPublishPage: FunctionReference<
        "query",
        "internal",
        {
          id: string;
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
        },
        {
          affects?: { pages: number };
          blocked?: boolean;
          summary: string;
          warn?: string;
        },
        Name
      >;
      publishPage: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
        },
        { pageId: string; published: boolean },
        Name
      >;
      saveDraft: FunctionReference<
        "mutation",
        "internal",
        {
          draftBody: string;
          id: string;
          principal?:
            | { kind: "anonymous" }
            | { kind: "user"; userId: string }
            | { agentId: string; kind: "agent" };
          slug: string;
          title: string;
        },
        null,
        Name
      >;
    };
  };
