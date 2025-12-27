<script setup lang="ts">
import { ref, computed } from 'vue'

type GenreCover = {
  id: number
  title: string
  cover: string
}

const props = defineProps<{
  rank: number
  data: {
    genre: string
    count: number
    meanScore: number
    minutesWatched: number
    covers: GenreCover[]
  }
}>()

const hours = computed(() =>
  Math.round(props.data.minutesWatched / 60)
)

function anilistUrl(id: number) {
  return `https://anilist.co/anime/${id}`
}

// 👇 Gallery Ref
const galleryRef = ref<HTMLDivElement | null>(null)

// 👇 Scroll helpers
function scrollLeft() {
  galleryRef.value?.scrollBy({
    left: -300,
    behavior: 'smooth',
  })
}

function scrollRight() {
  galleryRef.value?.scrollBy({
    left: 300,
    behavior: 'smooth',
  })
}
</script>


<template>
  <div
    class="rounded-2xl bg-zinc-900/40 border border-zinc-800 p-4
           flex gap-4"
  >
    <!-- LEFT: Featured -->
    <a
      v-if="data.covers[0]"
      :href="anilistUrl(data.covers[0].id)"
      target="_blank"
      rel="noopener"
      :title="data.covers[0].title"
      class="shrink-0"
    >
      <img
        :src="data.covers[0].cover"
        class="h-36 aspect-2/3 rounded-xl object-cover
               hover:scale-105 transition"
      />
    </a>

    <!-- RIGHT -->
    <div class="flex flex-col flex-1 gap-3 overflow-hidden">
      <!-- Header -->
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-semibold">
          {{ data.genre }}
        </h3>
        <span class="text-xs bg-zinc-800 px-2 py-1 rounded-full">
          {{ rank }}
        </span>
      </div>

      <!-- Stats -->
      <div class="flex gap-6 text-sm">
        <div>
          <div class="text-zinc-400">Count</div>
          <div class="font-medium">{{ data.count }}</div>
        </div>
        <div>
          <div class="text-zinc-400">Mean Score</div>
          <div class="font-medium">
            {{ data.meanScore || '—' }}%
          </div>
        </div>
        <div>
          <div class="text-zinc-400">Time</div>
          <div class="font-medium">{{ hours }} h</div>
        </div>
      </div>

      <!-- Gallery Wrapper -->
<div
  class="relative group"
>
  <!-- LEFT OVERLAY -->
  <button
    v-if="data.covers.length > 4"
    @click="scrollLeft"
    class="absolute left-0 top-0 h-full w-10
           flex items-center justify-center
           bg-linear-to-r from-black/60 to-transparent
           opacity-0 group-hover:opacity-100
           transition"
    aria-label="Scroll left"
  >
    <svg
      class="w-5 h-5 text-white/80"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M15 19l-7-7 7-7"
      />
    </svg>
  </button>

  <!-- RIGHT OVERLAY -->
  <button
    v-if="data.covers.length > 4"
    @click="scrollRight"
    class="absolute right-0 top-0 h-full w-10
           flex items-center justify-center
           bg-linear-to-l from-black/60 to-transparent
           opacity-0 group-hover:opacity-100
           transition"
    aria-label="Scroll right"
  >
    <svg
      class="w-5 h-5 text-white/80"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M9 5l7 7-7 7"
      />
    </svg>
  </button>

  <!-- COVER STRIP -->
  <div
    ref="galleryRef"
    class="flex gap-2 overflow-hidden px-10"
  >
    <a
      v-for="anime in data.covers.slice(1)"
      :key="anime.id"
      :href="anilistUrl(anime.id)"
      target="_blank"
      rel="noopener"
      :title="anime.title"
      class="shrink-0"
    >
      <img
        :src="anime.cover"
        class="h-20 aspect-2/3 rounded
               object-cover transition
               hover:scale-105"
      />
    </a>
  </div>
</div>

    </div>
  </div>
</template>
