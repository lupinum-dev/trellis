<template>
  <div class="grid gap-4">
    <UCard>
      <template #header>
        <h3 class="text-lg font-semibold">Create client workspace</h3>
      </template>

      <form class="space-y-4" @submit.prevent="handleCreate">
        <div class="space-y-1">
          <label class="text-sm font-medium text-highlighted">Workspace name</label>
          <UInput v-model="createForm.name" required />
        </div>
        <div class="space-y-1">
          <label class="text-sm font-medium text-highlighted">Slug</label>
          <UInput v-model="createForm.slug" required />
        </div>
        <UButton type="submit" block :loading="createWorkspace.pending.value">
          Create workspace
        </UButton>
      </form>
    </UCard>
  </div>

  <UAlert
    color="info"
    variant="subtle"
    icon="i-lucide-lightbulb"
    title="Multi-workspace tip"
    description="Create a first client workspace, then add memberships through protected Convex flows. The point of this example is the memberships table and workspace switching, not open onboarding."
  />
</template>

<script setup lang="ts">
import { reactive } from 'vue'

import { operations } from '#trellis/operations/client'

const toast = useToast()
const createForm = reactive({ name: '', slug: '' })

const createWorkspace = useTrellisOperation(operations.workspaces.create)

async function handleCreate() {
  try {
    await createWorkspace.execute(createForm)
    toast.add({ title: 'Workspace created', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Could not create workspace',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>
