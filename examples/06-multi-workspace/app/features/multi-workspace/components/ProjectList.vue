<template>
  <UCard>
    <template #header>
      <h3 class="text-lg font-semibold">Projects</h3>
      <p class="text-sm text-muted mt-1">
        Projects in the current workspace. Scoped to the active tenant.
      </p>
    </template>

    <div class="space-y-4">
      <form
        v-if="canCreate"
        class="flex flex-col gap-3 md:flex-row md:items-end"
        @submit.prevent="handleCreate"
      >
        <div class="flex-1 space-y-1">
          <label class="text-sm font-medium text-highlighted">Project name</label>
          <UInput v-model="projectName" placeholder="Client rebrand" required />
        </div>
        <UButton type="submit" :loading="createProject.pending.value" leading-icon="i-lucide-plus">
          Create project
        </UButton>
      </form>

      <div v-if="!projects?.length" class="flex flex-col items-center gap-2 py-8 text-muted">
        <UIcon name="i-lucide-folder-open" class="h-8 w-8" />
        <p class="text-sm">No projects in this workspace yet.</p>
      </div>

      <ul class="space-y-2">
        <li
          v-for="project in projects"
          :key="project._id"
          class="flex items-center justify-between gap-3 rounded-xl border border-default bg-elevated px-4 py-3"
          :class="project.status === 'paused' ? 'opacity-60' : ''"
        >
          <span class="font-medium text-highlighted">{{ project.name }}</span>
          <div class="flex items-center gap-2">
            <UBadge
              :color="project.status === 'active' ? 'success' : 'neutral'"
              variant="subtle"
              size="xs"
            >
              {{ project.status }}
            </UBadge>
            <UButton
              v-if="canCreate"
              size="xs"
              :color="project.status === 'active' ? 'warning' : 'success'"
              variant="soft"
              :leading-icon="project.status === 'active' ? 'i-lucide-pause' : 'i-lucide-play'"
              @click="handleToggle(project._id)"
            >
              {{ project.status === 'active' ? 'Pause' : 'Activate' }}
            </UButton>
          </div>
        </li>
      </ul>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { operations } from '#trellis/operations/client'

defineProps<{
  projects: Array<{ _id: Id<'projects'>; name: string; status: string }> | null
  canCreate: boolean
}>()

const toast = useToast()
const projectName = ref('')

const createProject = useTrellisOperation(operations.projects.create)
const toggleStatus = useTrellisOperation(operations.projects.toggleStatus)

async function handleCreate() {
  try {
    await createProject.execute({ name: projectName.value })
    toast.add({ title: 'Project created', color: 'success' })
    projectName.value = ''
  } catch (error) {
    toast.add({
      title: 'Could not create project',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

async function handleToggle(id: Id<'projects'>) {
  try {
    await toggleStatus.execute({ id })
    toast.add({ title: 'Project status updated', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Could not update status',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>
