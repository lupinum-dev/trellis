<script setup lang="ts">
import { createTodo } from '~~/shared/features/todos/contract'

import { api } from '#trellis/api'
import { operations } from '#trellis/operations/client'

const { isAuthenticated, isPending, signOut, sessionUser } = useConvexAuth()
const { signIn, pending: signInPending, error: signInError } = useBetterAuthSignIn()
const { signUp, pending: signUpPending, error: signUpError } = useBetterAuthSignUp()

const email = ref('demo@example.com')
const password = ref('password1234')
const title = ref('')

const todoArgs = computed(() => (isAuthenticated.value ? {} : undefined))
const { data: todos } = await useConvexQuery(api.features.todos.domain.list, todoArgs)
const createTodoOperation = useTrellisOperation(operations.todos.create)
const toggleTodoOperation = useTrellisOperation(operations.todos.toggle)

async function handleSignIn() {
  await signIn({
    email: email.value,
    password: password.value,
  })
}

async function handleSignUp() {
  await signUp({
    email: email.value,
    password: password.value,
    name: email.value.split('@')[0] ?? email.value,
  })
}

async function handleCreateTodo() {
  const parsed = createTodo.zod.safeParse({ title: title.value })
  if (!parsed.success) return

  await createTodoOperation.execute(parsed.data)
  title.value = ''
}
</script>

<template>
  <main style="max-width: 720px; margin: 0 auto; padding: 40px 16px">
    <h1>Personal Starter</h1>
    <p>Trellis app starter: Better Auth + Convex + app-owned appIdentity resolution.</p>

    <div v-if="isPending">Loading auth...</div>

    <div v-else-if="!isAuthenticated" style="display: grid; gap: 12px; max-width: 320px">
      <input v-model="email" type="email" placeholder="Email" />
      <input v-model="password" type="password" placeholder="Password" />
      <div style="display: flex; gap: 8px">
        <button :disabled="signInPending" @click="handleSignIn">Sign in</button>
        <button :disabled="signUpPending" @click="handleSignUp">Sign up</button>
      </div>
      <p v-if="signInError">{{ signInError.message }}</p>
      <p v-if="signUpError">{{ signUpError.message }}</p>
    </div>

    <div v-else style="display: grid; gap: 16px">
      <p>Signed in as {{ sessionUser?.email ?? sessionUser?.displayName ?? 'user' }}</p>
      <div style="display: flex; gap: 8px">
        <input v-model="title" type="text" placeholder="Add a todo" />
        <button :disabled="createTodoOperation.pending.value" @click="handleCreateTodo">Add</button>
        <button @click="signOut()">Sign out</button>
      </div>

      <ul style="display: grid; gap: 8px; padding-left: 20px">
        <li v-for="todo in todos ?? []" :key="todo._id">
          <label style="display: flex; gap: 8px; align-items: center">
            <input
              type="checkbox"
              :checked="todo.completed"
              @change="toggleTodoOperation.execute({ id: todo._id })"
            />
            <span>{{ todo.title }}</span>
          </label>
        </li>
      </ul>
    </div>
  </main>
</template>
