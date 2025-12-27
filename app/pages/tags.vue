<script setup lang="ts">
import { api } from "~/composables/useApi";
import { normalizeAnilist } from "~/utils/normalizeAnilist";
import type { AnimeEntry } from "~/types/anime";
import GenreCard from "../components/GenreCard.vue";

/* -----------------------------
 * Types
 * ----------------------------- */
type TagCover = {
  id: number;
  title: string;
  cover: string;
};

type LayoutMode = "grid" | "list";

/* -----------------------------
 * State
 * ----------------------------- */
const username = ref("Tiggy");
const loading = ref(false);
const error = ref<string | null>(null);
const entries = ref<AnimeEntry[]>([]);
const layoutMode = ref<LayoutMode>("grid");

/* -----------------------------
 * API
 * ----------------------------- */
async function loadAnime() {
  loading.value = true;
  error.value = null;

  try {
    const res = await api.post("/api/anilist", null, {
      params: { user: username.value },
    });
    entries.value = normalizeAnilist(
      res.data.data.MediaListCollection.lists
    );
  } catch (e: any) {
    error.value = e?.message ?? "Unbekannter Fehler";
  } finally {
    loading.value = false;
  }
}

onMounted(loadAnime);

/* -----------------------------
 * Tag Filter
 * ----------------------------- */
const selectedTags = ref<string[]>([]);

const allTags = computed(() => {
  const set = new Set<string>();
  entries.value.forEach((e) =>
    e.tags?.forEach((t) => set.add(t.name))
  );
  return [...set].sort();
});

const filteredEntries = computed(() => {
  if (!selectedTags.value.length) return entries.value;

  return entries.value.filter((e) =>
    selectedTags.value.every((t) =>
      e.tags?.some((et) => et.name === t)
    )
  );
});

const isCombinedMode = computed(() => selectedTags.value.length > 1);

/* -----------------------------
 * GRID: Tag Ranking
 * ----------------------------- */
const normalTagStats = computed(() => {
  const map: Record<
    string,
    {
      count: number;
      scoreSum: number;
      scoreCount: number;
      minutes: number;
      covers: TagCover[];
    }
  > = {};

  for (const e of filteredEntries.value) {
    const minutes = (e.progress ?? 0) * (e.duration ?? 0);

    for (const tag of e.tags ?? []) {
      const tagName = tag.name;

      if (!map[tagName]) {
        map[tagName] = {
          count: 0,
          scoreSum: 0,
          scoreCount: 0,
          minutes: 0,
          covers: [],
        };
      }

      map[tagName].count++;
      map[tagName].minutes += minutes;

      if (e.score && e.score > 0) {
        map[tagName].scoreSum += e.score;
        map[tagName].scoreCount++;
      }

      if (e.id && e.coverImage) {
        const cover =
          typeof e.coverImage === "string"
            ? e.coverImage
            : e.coverImage.extraLarge ||
              e.coverImage.large ||
              e.coverImage.medium;

        if (cover) {
          map[tagName].covers.push({
            id: e.id,
            title:
              e.title?.english ??
              e.title?.romaji ??
              "Unknown title",
            cover,
          });
        }
      }
    }
  }

  return Object.entries(map).map(([tag, t]) => ({
    genre: tag, // 👈 bewusst "genre", damit GenreCard wiederverwendet wird
    count: t.count,
    meanScore: t.scoreCount
      ? Math.round(t.scoreSum / t.scoreCount)
      : 0,
    minutesWatched: t.minutes,
    covers: t.covers,
  }));
});

/* -----------------------------
 * COMBINED Tag Stats
 * ----------------------------- */
const combinedStats = computed(() => {
  if (!isCombinedMode.value) return null;

  let minutes = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const covers: TagCover[] = [];

  for (const e of filteredEntries.value) {
    minutes += (e.progress ?? 0) * (e.duration ?? 0);

    if (e.score && e.score > 0) {
      scoreSum += e.score;
      scoreCount++;
    }

    if (e.id && e.coverImage) {
      const cover =
        typeof e.coverImage === "string"
          ? e.coverImage
          : e.coverImage.extraLarge ||
            e.coverImage.large ||
            e.coverImage.medium;

      if (cover) {
        covers.push({
          id: e.id,
          title:
            e.title?.english ??
            e.title?.romaji ??
            "Unknown title",
          cover,
        });
      }
    }
  }

  return {
    genre: selectedTags.value.join(" + "),
    count: filteredEntries.value.length,
    meanScore: scoreCount
      ? Math.round(scoreSum / scoreCount)
      : 0,
    minutesWatched: minutes,
    covers,
  };
});

const displayedTags = computed(() => {
  if (combinedStats.value) return [combinedStats.value];
  return normalTagStats.value;
});

/* -----------------------------
 * LIST MODE
 * ----------------------------- */
const listSummary = computed(() => {
  if (!filteredEntries.value.length) return null;

  let minutes = 0;
  let scoreSum = 0;
  let scoreCount = 0;

  for (const e of filteredEntries.value) {
    minutes += (e.progress ?? 0) * (e.duration ?? 0);
    if (e.score && e.score > 0) {
      scoreSum += e.score;
      scoreCount++;
    }
  }

  return {
    title: selectedTags.value.length
      ? selectedTags.value.join(" + ")
      : "Alle Tags",
    count: filteredEntries.value.length,
    meanScore: scoreCount
      ? Math.round(scoreSum / scoreCount)
      : 0,
    hours: Math.round(minutes / 60),
  };
});

const listAnime = computed(() =>
  filteredEntries.value.map((e) => {
    const relevantTags =
      selectedTags.value.length
        ? e.tags?.filter((t) =>
            selectedTags.value.includes(t.name)
          ) ?? []
        : [];

    return {
      id: e.id,
      title: e.title?.english ?? e.title?.romaji ?? "Unknown",
      cover:
        typeof e.coverImage === "string"
          ? e.coverImage
          : e.coverImage?.medium,
      score: e.score,

      tagRanks: relevantTags.map((t) => ({
        name: t.name,
        rank: t.rank,
      })),
    };
  })
);


/* -----------------------------
 * Helpers
 * ----------------------------- */
function toggleTag(tag: string) {
  const i = selectedTags.value.indexOf(tag);
  i === -1
    ? selectedTags.value.push(tag)
    : selectedTags.value.splice(i, 1);
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Tags</h1>
      <div class="flex gap-2">
        <input
          v-model="username"
          class="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded"
        />
        <button
          @click="loadAnime"
          class="bg-indigo-600 px-4 py-2 rounded"
        >
          Laden
        </button>
      </div>
    </div>

    <!-- Layout Switch -->
    <div class="flex justify-end gap-2">
      <button
        @click="layoutMode = 'grid'"
        class="px-3 py-1 text-xs rounded border"
        :class="layoutMode === 'grid'
          ? 'bg-indigo-600 text-white'
          : 'bg-zinc-900 text-zinc-300'"
      >
        Grid
      </button>
      <button
        @click="layoutMode = 'list'"
        class="px-3 py-1 text-xs rounded border"
        :class="layoutMode === 'list'
          ? 'bg-indigo-600 text-white'
          : 'bg-zinc-900 text-zinc-300'"
      >
        List
      </button>
    </div>

    <!-- Tag Filter -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="t in allTags"
        :key="t"
        @click="toggleTag(t)"
        class="px-3 py-1 rounded-full text-xs border"
        :class="selectedTags.includes(t)
          ? 'bg-indigo-600 text-white'
          : 'bg-zinc-900 text-zinc-300'"
      >
        {{ t }}
      </button>

      <button
        v-if="selectedTags.length"
        @click="selectedTags = []"
        class="px-3 py-1 rounded-full text-xs bg-zinc-800"
      >
        Reset
      </button>
    </div>

    <!-- GRID -->
    <div
      v-if="layoutMode === 'grid'"
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <GenreCard
        v-for="(g, i) in displayedTags"
        :key="g.genre"
        :rank="i + 1"
        :data="g"
      />
    </div>

    <!-- LIST -->
    <div v-else class="space-y-3">
      <div
        v-if="listSummary"
        class="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4 flex gap-6"
      >
        <div class="font-semibold">
          {{ listSummary.title }}
        </div>
        <div class="flex gap-6 text-sm text-zinc-300">
          <span>{{ listSummary.count }} Anime</span>
          <span>{{ listSummary.meanScore || "—" }}</span>
          <span>{{ listSummary.hours }} h</span>
        </div>
      </div>

      <div
        v-for="a in listAnime"
        :key="a.id"
        class="flex gap-4 items-center
               p-3 rounded-xl
               border border-zinc-800
               bg-zinc-900/30"
      >
        <img
          v-if="a.cover"
          :src="a.cover"
          class="h-14 aspect-2/3 rounded object-cover"
        />
        <div class="flex-1 truncate">
          {{ a.title }}
        </div>
        <div class="flex flex-col items-end text-xs text-zinc-400">
  <span>{{ a.score || "—" }}</span>

  <span v-if="a.tagRanks.length" class="text-zinc-500">
    <template v-for="(t, i) in a.tagRanks" :key="t.name">
      <span v-if="i > 0"> + </span>
      {{ t.name }} {{ t.rank }}%
    </template>
  </span>
</div>
      </div>
    </div>
  </div>
</template>
