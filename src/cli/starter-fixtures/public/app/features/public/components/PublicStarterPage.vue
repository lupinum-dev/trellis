<script setup lang="ts">
import { createTodo } from '~~/shared/features/todos/contract'

import { api } from '#trellis/api'
import { operations } from '#trellis/operations/client'

const title = ref('')

const { data: todos } = await useConvexQuery(api.features.todos.domain.list, {})
const createTodoOperation = useTrellisOperation(operations.todos.create)
const toggleTodoOperation = useTrellisOperation(operations.todos.toggle)
const removeTodoOperation = useTrellisOperation(operations.todos.remove)

async function handleCreateTodo() {
  const parsed = createTodo.zod.safeParse({ title: title.value })
  if (!parsed.success) return

  await createTodoOperation.execute(parsed.data)
  title.value = ''
}

async function handleRemoveTodo(todo: { _id: string; title: string }) {
  if (!confirm(`Delete "${todo.title}"?`)) return

  await removeTodoOperation.execute({ id: todo._id as never })
}
</script>

<template>
  <main style="max-width: 720px; margin: 0 auto; padding: 40px 16px">
    <h1>Public Starter</h1>
    <p>Trellis app starter: live query plus public mutations, no auth required.</p>

    <div style="display: grid; gap: 16px">
      <div style="display: flex; gap: 8px">
        <input v-model="title" type="text" placeholder="Add a todo" />
        <button :disabled="createTodoOperation.pending.value" @click="handleCreateTodo">Add</button>
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
          <button :disabled="removeTodoOperation.pending.value" @click="handleRemoveTodo(todo)">
            Delete
          </button>
        </li>
      </ul>
    </div>
  </main>
</template>
