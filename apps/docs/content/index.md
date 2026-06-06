---
title: 'Trellis'
navigation: false
description: 'Build Nuxt + Convex apps with one backend path for data, auth, permissions, server routes, and MCP tools.'
---

# Trellis

Trellis is for Nuxt apps that use Convex as the backend and need the same rules to work in more than one place.

That usually means browser pages, server routes, signed-in users, workspace data, permissions, webhooks, or MCP tools.

The main idea is simple:

Put the important rules in Convex. Let every caller go through that same backend path.

Do not use Trellis if raw Nuxt + Convex is enough. Trellis is opinionated on purpose. It gives you a generated app layout, supported starter lanes, examples, lint rules, `doctor`, and runtime checks. That is useful when your app will grow into auth, permissions, server routes, or agents. It is too much if you only need a tiny public app.

::callout{icon="i-lucide-arrow-right" color="neutral" to="/docs/getting-started/start-here"}
Start with [Start here](/docs/getting-started/start-here), then build [First live query](/docs/getting-started/first-live-query).
::

:u-input-copy{value="pnpm dlx @lupinum/trellis init my-app"}

## Common paths

::card-group

::card{title="Start here" icon="i-lucide-compass" to="/docs/getting-started/start-here"}
What Trellis is, when to use it, and how to start with the smallest app that proves your setup.
::

::card{title="Adoption decision" icon="i-lucide-compass" to="/docs/getting-started/adoption-decision"}
Decide whether Trellis fits before you add framework structure to your app.
::

::card{title="Installation" icon="i-lucide-download" to="/docs/getting-started/installation"}
Install the module, wire the required environment, and run the first health check.
::

::card{title="First live query" icon="i-lucide-rocket" to="/docs/getting-started/first-live-query"}
Build the smallest useful Trellis app: one query, one mutation, one visible live update.
::

::card{title="Signed-in todo app" icon="i-lucide-lock" to="/docs/getting-started/build-a-signed-in-todo-app"}
Add auth without jumping straight into workspaces, roles, or MCP.
::

::card{title="Examples" icon="i-lucide-layout-template" to="/docs/examples"}
Pick the smallest example that matches the app you are actually building.
::

::

## What you get

Trellis handles the repeated framework wiring:

- Nuxt module setup
- Convex client setup
- SSR-aware queries
- live subscriptions
- mutation state
- Better Auth integration
- auth refresh after sign-in
- permission projection into the UI
- server helpers for Nitro routes
- MCP tool helpers
- doctor checks for common setup mistakes

You still own the product rules:

- what tables exist
- what a user means in your app
- what a workspace means
- who can create, update, delete, invite, publish, revoke, or export
- what a destructive action should preview before it runs

Trellis gives you the path. It does not invent your business logic.

## What it looks like

::tabs

:::tabs-item{label="Query" icon="i-lucide-database"}

```vue [app/features/todos/TodoList.vue]
<script setup lang="ts">
import { api } from '#trellis/api'

const { data: todos, pending, error } = await useConvexQuery(api.features.todos.domain.list, {})
</script>

<template>
  <p v-if="error">{{ error.message }}</p>
  <p v-else-if="pending">Loading...</p>
  <ul v-else>
    <li v-for="todo in todos" :key="todo._id">
      {{ todo.title }}
    </li>
  </ul>
</template>
```

:::

:::tabs-item{label="Mutation" icon="i-lucide-edit"}

```vue [app/features/todos/CreateTodo.vue]
<script setup lang="ts">
import { api } from '#trellis/api'

const createTodo = useConvexMutation(api.features.todos.domain.create)

await createTodo({ title: 'Ship my app' })
</script>
```

:::

:::tabs-item{label="Auth" icon="i-lucide-lock"}

```vue [app/features/auth/AuthButton.vue]
<script setup lang="ts">
const { isAuthenticated, sessionUser, signOut } = useConvexAuth()
const client = useBetterAuthClient()

async function signIn() {
  await client?.signIn.social({ provider: 'github' })
}
</script>

<template>
  <button v-if="isAuthenticated" @click="signOut()">Sign out {{ sessionUser?.displayName }}</button>
  <button v-else @click="signIn">Sign in with GitHub</button>
</template>
```

:::

::

## Explore the docs

::card-group

::card{title="Getting started" icon="i-lucide-compass" to="/docs/getting-started"}
Start small, prove the live data path, then add auth only when you need it.
::

::card{title="Guides" icon="i-lucide-route" to="/docs/guides"}
Task pages for data, auth, permissions, server-side flows, uploads, and MCP tools.
::

::card{title="Concepts" icon="i-lucide-waypoints" to="/docs/concepts"}
The mental model behind the backend-owned app path.
::

::card{title="Reference" icon="i-lucide-book-type" to="/docs/reference"}
Exact behavior for composables, runtime helpers, config, and generated API inventory.
::

::card{title="Project" icon="i-lucide-git-branch" to="/docs/project"}
Contributor entry points and the public change record.
::

::
