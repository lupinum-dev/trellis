<template>
  <div
    class="min-h-screen flex items-center justify-center p-6 bg-linear-to-br from-indigo-50 to-white dark:from-indigo-950/20 dark:to-neutral-950"
  >
    <UCard class="w-full max-w-3xl">
      <template #header>
        <UButton :to="backLink" variant="link" leading-icon="i-lucide-arrow-left" class="mb-2">
          {{ kbId ? 'Back to knowledge base' : 'Back to home' }}
        </UButton>
        <div class="flex items-center gap-3 mt-2">
          <h1 class="text-2xl font-bold">{{ article?.title ?? 'Loading...' }}</h1>
          <AccessBadge v-if="article" :level="article._access" />
          <UBadge v-if="article?.status === 'draft'" color="warning" variant="subtle" size="xs">
            draft
          </UBadge>
        </div>
      </template>

      <div v-if="error" class="space-y-3">
        <UAlert color="error" :title="error.message" />
        <p class="text-sm text-muted">
          You may need enrollment, to complete a prerequisite, or to use a share link.
        </p>
      </div>

      <div v-else-if="article" class="space-y-4">
        <div class="prose dark:prose-invert max-w-none">
          <p>{{ article.body }}</p>
        </div>

        <!-- Internal notes (only visible to editors+) -->
        <UCard v-if="article.internalNotes" variant="subtle">
          <template #header>
            <div class="flex items-center gap-2">
              <UIcon name="i-lucide-eye-off" class="w-4 h-4" />
              <span class="text-sm font-semibold">Internal notes</span>
            </div>
          </template>
          <p class="text-sm">{{ article.internalNotes }}</p>
        </UCard>

        <!-- Actions -->
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="canPublish && article.status === 'draft'"
            color="success"
            variant="soft"
            leading-icon="i-lucide-check"
            :loading="publishArticle.pending.value"
            @click="handlePublish"
          >
            Publish article
          </UButton>
          <UButton
            v-if="canCompleteArticle"
            color="success"
            variant="soft"
            leading-icon="i-lucide-check-circle"
            :loading="markCompleted.pending.value"
            @click="handleComplete"
          >
            Mark as completed
          </UButton>
        </div>

        <!-- Share link creation (editors+) -->
        <ShareLinkDialog v-if="canShare" :article-id="articleId" />
      </div>

      <div v-else>
        <USkeleton class="h-32 w-full rounded-xl" />
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import AccessBadge from '~~/app/features/visibility-access/components/AccessBadge.vue'
import ShareLinkDialog from '~~/app/features/visibility-access/components/ShareLinkDialog.vue'
import type { Id } from '~~/convex/_generated/dataModel'

import { api } from '#trellis/api'
import { operations } from '#trellis/operations/client'
import { articleCreate, shareCreate } from '#trellis/permissions'

const route = useRoute()
const toast = useToast()
const articleId = route.params.id as Id<'articles'>
const shareToken = route.query.token as string | undefined
const kbId = route.query.kbId as string | undefined

const backLink = computed(() => (kbId ? `/kb/${kbId}` : '/'))

const { can } = useAccess()
const canShare = can(shareCreate)
const canPublish = can(articleCreate)
const canCompleteArticle = computed(
  () => !shareToken && article.value?.status === 'published' && article.value._access !== 'edit',
)

const workspaceArticleQuery = await useConvexQuery(
  api.features.articles.domain.view,
  computed(() => (shareToken ? null : { id: articleId })),
)
const sharedArticleQuery = await useConvexQuery(
  api.features.articles.domain.viewShared,
  computed(() => (shareToken ? { id: articleId, shareToken } : null)),
)
const article = computed(() =>
  shareToken ? sharedArticleQuery.data.value : workspaceArticleQuery.data.value,
)
const error = computed(() =>
  shareToken ? sharedArticleQuery.error.value : workspaceArticleQuery.error.value,
)

const markCompleted = useTrellisOperation(operations.articles.markCompleted)
const publishArticle = useTrellisOperation(operations.articles.publish)

async function handleComplete() {
  try {
    await markCompleted.execute({ articleId })
    toast.add({ title: 'Marked as completed', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Could not mark completed',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}

async function handlePublish() {
  try {
    await publishArticle.execute({ id: articleId })
    toast.add({ title: 'Article published', color: 'success' })
  } catch (error) {
    toast.add({
      title: 'Could not publish',
      description: error instanceof Error ? error.message : String(error),
      color: 'error',
    })
  }
}
</script>
