<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { operations } from '#trellis/operations/client'

import type { BoardTask } from '../types/board-task'

const props = defineProps<{
  projectId: Id<'projects'>
  task: BoardTask
  selected: boolean
  memberNames?: Map<string, string>
}>()

const emit = defineEmits<{
  toggleSelected: [id: Id<'tasks'>]
}>()

const toast = useToast()
const moveTask = useTrellisOperation(operations.tasks.moveToColumn)
const deleteTask = useTrellisOperation(operations.tasks.remove)

const priorityColor = computed(() => {
  if (props.task.priority === 'high') return 'error'
  if (props.task.priority === 'medium') return 'warning'
  return 'neutral'
})

function nextStatus() {
  if (props.task.status === 'backlog') return 'in_progress'
  if (props.task.status === 'in_progress') return 'done'
  return 'done'
}

function resolveName(userId: string) {
  return props.memberNames?.get(userId) ?? `Member ${userId.slice(0, 8)}…`
}

async function handleMoveTask() {
  try {
    await moveTask.execute({ id: props.task._id, status: nextStatus() })
  } catch (error) {
    toast.add({
      title: 'Could not move task',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

async function handleDeleteTask() {
  try {
    const preview = await deleteTask.preview({ id: props.task._id })
    if (!preview.confirmation) {
      toast.add({
        title: 'Could not delete task',
        description: 'Preview the destructive change again before confirming.',
        color: 'error',
      })
      return
    }
    await deleteTask.execute({ id: props.task._id }, { confirmation: preview.confirmation })
    toast.add({ title: 'Task deleted', color: 'success', icon: 'i-lucide-trash-2' })
  } catch (error) {
    toast.add({
      title: 'Could not delete task',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <article
    :data-testid="`task-card-${props.task._id}`"
    class="space-y-2 rounded-xl border border-default bg-default p-3"
  >
    <UCheckbox
      :model-value="selected"
      label="Select"
      :ui="{ label: 'text-sm text-muted' }"
      @update:model-value="emit('toggleSelected', props.task._id)"
    />

    <NuxtLink
      class="block font-semibold text-highlighted hover:underline"
      :data-testid="`task-link-${props.task._id}`"
      :to="`/tasks/${props.task._id}?projectId=${props.projectId}`"
    >
      {{ props.task.title }}
    </NuxtLink>

    <p class="text-sm text-muted">
      <UBadge size="xs" variant="subtle" :color="priorityColor">{{ props.task.priority }}</UBadge>
      <span v-if="props.task.assigneeId" class="ml-2">{{
        resolveName(props.task.assigneeId)
      }}</span>
    </p>

    <div class="flex gap-1.5">
      <UButton
        v-if="props.task._can.update && props.task.status !== 'done'"
        :data-testid="`task-move-${props.task._id}`"
        size="xs"
        variant="soft"
        color="neutral"
        leading-icon="i-lucide-arrow-right"
        @click="handleMoveTask"
      >
        Move to {{ nextStatus().replace('_', ' ') }}
      </UButton>
      <UButton
        v-if="props.task._can.delete"
        size="xs"
        variant="soft"
        color="error"
        leading-icon="i-lucide-trash-2"
        @click="handleDeleteTask"
      >
        Delete
      </UButton>
    </div>
  </article>
</template>
