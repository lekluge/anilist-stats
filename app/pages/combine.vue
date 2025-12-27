<script setup lang="ts">
import { api } from "~/composables/useApi";
import { normalizeAnilist } from "~/utils/normalizeAnilist";
import type { AnimeEntry } from "~/types/anime";
import GenreCard from "../components/GenreCard.vue";

/* -----------------------------
 * Types
 * ----------------------------- */
type Cover = {
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
 * Filters
 * ----------------------------- */
const selectedGenres = ref<string[]>([]);
const selectedTags = ref<string[]>([]);

const allGenres = computed(() => {
  const set = new Set<string>();
  entries.value.forEach((e) => e.genres?.forEach((g) => set.add(g)));
  return [...set].sort();
});

const allTags = computed(() => {
  const set = new Set<string>();
  entries.value.forEach((e) => e.tags?.forEach((t) => set.add(t.name)));
  return [...set].sort();
});

/* -----------------------------
 * FILTERED ENTRIES (CORE)
 * ----------------------------- */
const filteredEntries = computed(() => {
  return entries.value.filter((e) => {
    const genreOk =
      !selectedGenres.value.length ||
      selectedGenres.value.every((g) => e.genres?.includes(g));

    const tagOk =
      !selectedTags.value.length ||
      selectedTags.value.every((t) => e.tags?.some((et) => et.name === t));

    return genreOk && tagOk;
  });
});

const isCombinedMode = computed(
  () => selectedGenres.value.length + selectedTags.value.length > 1
);

/* -----------------------------
 * GRID STATS
 * ----------------------------- */
const gridStats = computed(() => {
  const map: Record<
    string,
    {
      count: number;
      scoreSum: number;
      scoreCount: number;
      minutes: number;
      covers: Cover[];
    }
  > = {};

  for (const e of filteredEntries.value) {
    const minutes = (e.progress ?? 0) * (e.duration ?? 0);

    const keys = [...(e.genres ?? []), ...(e.tags?.map((t) => t.name) ?? [])];

    for (const key of keys) {
      if (!map[key]) {
        map[key] = {
          count: 0,
          scoreSum: 0,
          scoreCount: 0,
          minutes: 0,
          covers: [],
        };
      }

      map[key].count++;
      map[key].minutes += minutes;

      if (e.score && e.score > 0) {
        map[key].scoreSum += e.score;
        map[key].scoreCount++;
      }

      if (e.id && e.coverImage) {
        const cover =
          typeof e.coverImage === "string"
            ? e.coverImage
            : e.coverImage.extraLarge ||
              e.coverImage.large ||
              e.coverImage.medium;

        if (cover) {
          map[key].covers.push({
            id: e.id,
            title: e.title?.english ?? e.title?.romaji ?? "Unknown title",
            cover,
          });
        }
      }
    }
  }

  return Object.entries(map).map(([key, g]) => ({
    genre: key,
    count: g.count,
    meanScore: g.scoreCount ? Math.round(g.scoreSum / g.scoreCount) : 0,
    minutesWatched: g.minutes,
    covers: g.covers,
  }));
});

/* -----------------------------
 * COMBINED GRID CARD
 * ----------------------------- */
const combinedGridCard = computed(() => {
  if (!isCombinedMode.value) return null;

  let minutes = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  const covers: Cover[] = [];

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
    genre: [...selectedGenres.value, ...selectedTags.value].join(" + "),
    count: filteredEntries.value.length,
    meanScore: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
    minutesWatched: minutes,
    covers,
  };
});

const displayedGrid = computed(() => {
  if (combinedGridCard.value) return [combinedGridCard.value];
  return gridStats.value;
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
    title:
      [...selectedGenres.value, ...selectedTags.value].join(" + ") ||
      "Alle Anime",
    count: filteredEntries.value.length,
    meanScore: scoreCount ? Math.round(scoreSum / scoreCount) : 0,
    hours: Math.round(minutes / 60),
  };
});

const listAnime = computed(() =>
  filteredEntries.value.map((e) => {
    const tagRanks = selectedTags.value.length
      ? e.tags?.filter((t) => selectedTags.value.includes(t.name)) ?? []
      : [];

    return {
      id: e.id,
      title: e.title?.english ?? e.title?.romaji ?? "Unknown",
      cover:
        typeof e.coverImage === "string" ? e.coverImage : e.coverImage?.medium,
      score: e.score,
      tagRanks,
    };
  })
);

/* -----------------------------
 * Helpers
 * ----------------------------- */
function toggleGenre(g: string) {
  const i = selectedGenres.value.indexOf(g);
  i === -1 ? selectedGenres.value.push(g) : selectedGenres.value.splice(i, 1);
}

function toggleTag(t: string) {
  const i = selectedTags.value.indexOf(t);
  i === -1 ? selectedTags.value.push(t) : selectedTags.value.splice(i, 1);
}
function anilistUrl(id: number) {
  return `https://anilist.co/anime/${id}`;
}
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center">
      <h1 class="text-3xl font-bold">Combined</h1>

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
        :class="
          layoutMode === 'grid'
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
        class="px-3 py-1 text-xs rounded border"
      >
        Grid
      </button>
      <button
        @click="layoutMode = 'list'"
        :class="
          layoutMode === 'list'
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
        class="px-3 py-1 text-xs rounded border"
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
        :class="
          selectedGenres.includes(g)
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
        class="px-3 py-1 rounded-full text-xs border"
      >
        {{ g }}
      </button>
    </div>

    <!-- Tag Filter -->
    <div class="flex flex-wrap gap-2">
      <button
        v-for="t in allTags"
        :key="t"
        @click="toggleTag(t)"
        :class="
          selectedTags.includes(t)
            ? 'bg-indigo-600 text-white'
            : 'bg-zinc-900 text-zinc-300'
        "
        class="px-3 py-1 rounded-full text-xs border"
      >
        {{ t }}
      </button>
    </div>

    <!-- GRID -->
    <div
      v-if="layoutMode === 'grid'"
      class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
    >
      <GenreCard
        v-for="(g, i) in displayedGrid"
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
          <span>{{ listSummary.meanScore || "—" }}%</span>
          <span>{{ listSummary.hours }} h</span>
        </div>
      </div>

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

        <div class="flex flex-col items-end text-xs text-zinc-400">
          <span>{{ a.score || "—" }}</span>

          <span v-if="a.tagRanks.length" class="text-zinc-500">
            <template v-for="(t, i) in a.tagRanks" :key="t.name">
              <span v-if="i"> + </span>
              {{ t.name }} {{ t.rank }}%
            </template>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
