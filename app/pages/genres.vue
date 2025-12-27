<script setup lang="ts">
import { api } from "~/composables/useApi";
import { normalizeAnilist } from "~/utils/normalizeAnilist";
import type { AnimeEntry } from "~/types/anime";
import GenreCard from "../components/GenreCard.vue";

/* -----------------------------
 * Types
 * ----------------------------- */
type GenreCover = {
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
    entries.value = normalizeAnilist(res.data.data.MediaListCollection.lists);
  } catch (e: any) {
    error.value = e?.message ?? "Unbekannter Fehler";
  } finally {
    loading.value = false;
  }
}

onMounted(loadAnime);

/* -----------------------------
 * Genre Filter
 * ----------------------------- */
const selectedGenres = ref<string[]>([]);

const allGenres = computed(() => {
  const set = new Set<string>();
  entries.value.forEach((e) => e.genres?.forEach((g) => set.add(g)));
  return [...set].sort();
});

const filteredEntries = computed(() => {
  if (!selectedGenres.value.length) return entries.value;
  return entries.value.filter((e) =>
    selectedGenres.value.every((g) => e.genres?.includes(g))
  );
});

const isCombinedMode = computed(() => selectedGenres.value.length > 1);

/* -----------------------------
 * GRID: Genre Ranking
 * ----------------------------- */
const normalGenreStats = computed(() => {
  const map: Record<
    string,
    {
      count: number;
      scoreSum: number;
      scoreCount: number;
      minutes: number;
      covers: GenreCover[];
    }
  > = {};

  for (const e of filteredEntries.value) {
    const minutes = (e.progress ?? 0) * (e.duration ?? 0);

    for (const genre of e.genres ?? []) {
      if (!map[genre]) {
        map[genre] = {
          count: 0,
          scoreSum: 0,
          scoreCount: 0,
          minutes: 0,
          covers: [],
        };
      }

      map[genre].count++;
      map[genre].minutes += minutes;

      if (e.score && e.score > 0) {
        map[genre].scoreSum += e.score;
        map[genre].scoreCount++;
      }

      if (e.id && e.coverImage) {
        const cover =
          typeof e.coverImage === "string"
            ? e.coverImage
            : e.coverImage.extraLarge ||
              e.coverImage.large ||
              e.coverImage.medium;

        if (cover) {
          map[genre].covers.push({
            id: e.id,
            title: e.title?.english ?? e.title?.romaji ?? "Unknown title",
            cover,
          });
        }
      }
    }
  }

  return Object.entries(map).map(([genre, g]) => ({
    genre,
    count: g.count,
    meanScore: g.scoreCount ? Math.round(g.scoreSum / g.scoreCount) : 0,
    minutesWatched: g.minutes,
    covers: g.covers,
  }));
});

const combinedStats = computed(() => {
  if (!isCombinedMode.value) return null;

  let minutes = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const covers: GenreCover[] = [];

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
          title: e.title?.english ?? e.title?.romaji ?? "Unknown title",
          cover,
        });
      }
    }
  }

  return {
    genre: selectedGenres.value.join(" + "),
    count: filteredEntries.value.length,
    meanScore: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
    minutesWatched: minutes,
    covers,
  };
});

const displayedGenres = computed(() => {
  if (combinedStats.value) return [combinedStats.value];
  return normalGenreStats.value;
});

/* -----------------------------
 * LIST MODE: Summary + Anime
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
    title: selectedGenres.value.length
      ? selectedGenres.value.join(" + ")
      : "Alle Anime",
    count: filteredEntries.value.length,
    meanScore: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
    hours: Math.round(minutes / 60),
  };
});

const listAnime = computed(() =>
  filteredEntries.value.map((e) => ({
    id: e.id,
    title: e.title?.english ?? e.title?.romaji ?? "Unknown",
    cover:
      typeof e.coverImage === "string" ? e.coverImage : e.coverImage?.medium,
    score: e.score,
    progress: e.progress,
  }))
);

/* -----------------------------
 * Helpers
 * ----------------------------- */
function toggleGenre(genre: string) {
  const i = selectedGenres.value.indexOf(genre);
  i === -1
    ? selectedGenres.value.push(genre)
    : selectedGenres.value.splice(i, 1);
}
function anilistUrl(id: number) {
  return `https://anilist.co/anime/${id}`;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Genres</h1>
      <div class="flex gap-2">
        <input
          v-model="username"
          class="bg-zinc-900 border border-zinc-800 px-3 py-2 rounded"
        />
        <button @click="loadAnime" class="bg-indigo-600 px-4 py-2 rounded">
          Laden
        </button>
      </div>
    </div>

    <!-- Layout Switch -->
    <div class="flex justify-end gap-2">
      <button
        @click="layoutMode = 'grid'"
        class="px-3 py-1 text-xs rounded border"
        :class="
          layoutMode === 'grid'
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
      >
        Grid
      </button>
      <button
        @click="layoutMode = 'list'"
        class="px-3 py-1 text-xs rounded border"
        :class="
          layoutMode === 'list'
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
      >
        List
      </button>
    </div>

    <!-- Genre Filter -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="g in allGenres"
        :key="g"
        @click="toggleGenre(g)"
        class="px-3 py-1 rounded-full text-xs border"
        :class="
          selectedGenres.includes(g)
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
      >
        {{ g }}
      </button>

      <button
        v-if="selectedGenres.length"
        @click="selectedGenres = []"
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
        v-for="(g, i) in displayedGenres"
        :key="g.genre"
        :rank="i + 1"
        :data="g"
      />
    </div>

    <!-- LIST -->
    <div v-else class="space-y-3">
      <!-- Summary -->
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

      <!-- Anime List -->
      <div
        v-for="a in listAnime"
        :key="a.id"
        class="flex gap-4 items-center p-3 rounded-xl border border-zinc-800 bg-zinc-900/30"
      >
        <img
          v-if="a.cover"
          :src="a.cover"
          class="h-14 aspect-2/3 rounded object-cover"
        />
        <a
          :href="anilistUrl(a.id)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex-1 truncate hover:underline hover:text-indigo-400 cursor-pointer"
        >
          {{ a.title }}
        </a>
        <div class="text-xs text-zinc-400">
          {{ a.score || "—" }}
        </div>
      </div>
    </div>
  </div>
</template>
