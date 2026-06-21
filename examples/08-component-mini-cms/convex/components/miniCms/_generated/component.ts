/* eslint-disable */
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
    features: {
      pages: {
        domain: {
          create: FunctionReference<
            "mutation",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
              draftBody?: string;
              slug: string;
              title: string;
            },
            string,
            Name
          >;
          getPublished: FunctionReference<
            "query",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
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
          listDraft: FunctionReference<
            "query",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
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
          listPublished: FunctionReference<
            "query",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
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
          listStudio: FunctionReference<
            "query",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
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
          publish: FunctionReference<
            "mutation",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _confirmationToken?: string;
              _trellisForwarding?: string;
              id: string;
            },
            { pageId: string; published: boolean },
            Name
          >;
          save: FunctionReference<
            "mutation",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
              draftBody: string;
              id: string;
              slug: string;
              title: string;
            },
            null,
            Name
          >;
        };
        operations: {
          previewPublish: FunctionReference<
            "mutation",
            "internal",
            {
              __trellis?: {
                correlationId: string;
                originTransport:
                  | "browser"
                  | "nuxt-server"
                  | "convex"
                  | "mcp"
                  | "service"
                  | "webhook";
                requestId?: string;
              };
              _trellisForwarding?: string;
              id: string;
            },
            {
              allowed: boolean;
              blockers: Array<{ code: string; details?: any; message: string }>;
              confirm: {
                affectedCounts: { pages: number };
                operation: "pages.publish";
                targetId: string;
              };
              confirmation?: { expiresAt: number; token: string };
              details?: {
                affects?: { pages: number };
                blocked?: boolean;
                summary: string;
                warn?: string;
              };
              effects: Array<{
                count?: number;
                details?: any;
                kind: string;
                summary: string;
                target?: string;
              }>;
              summary: string;
              version?: any;
              warnings: Array<{ code: string; details?: any; message: string }>;
            },
            Name
          >;
        };
      };
    };
  };
