<script setup lang="ts">
import type { Id } from '~~/convex/_generated/dataModel'

import { operations } from '#trellis/operations/client'

const props = defineProps<{
  selectedIds: Id<'tasks'>[]
}>()

const emit = defineEmits<{
  cleared: []
}>()

const toast = useToast()
const bulkUpdate = useTrellisOperation(operations.tasks.bulkUpdateStatus)

async function markDone() {
  try {
    const result = await bulkUpdate.execute({
      ids: props.selectedIds,
      status: 'done',
    })

    const message = result.skipped.length
      ? `${result.updated} updated, ${result.skipped.length} skipped.`
      : `Updated ${result.updated} task(s).`

    toast.add({ title: message, color: 'success', icon: 'i-lucide-check-check' })
    emit('cleared')
  } catch (error) {
    toast.add({
      title: 'Bulk update failed',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>

<template>
  <div
    v-if="selectedIds.length"
    class="flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl border border-default bg-elevated"
  >
    <p class="text-sm text-muted">{{ selectedIds.length }} selected</p>

    <UButton
      data-testid="bulk-complete"
      size="sm"
      :loading="bulkUpdate.pending.value"
      leading-icon="i-lucide-check-check"
      @click="markDone"
    >
      Mark selected as done
    </UButton>
  </div>
</template>
