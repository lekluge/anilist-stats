export default defineEventHandler(async (event) => {
  const { user } = getQuery(event);
  const userName = String(user || "").trim();

  if (!userName) {
    throw createError({ statusCode: 400, statusMessage: "Missing ?user=" });
  }

  const query = `
    query ($userName: String) {
      MediaListCollection(userName: $userName, type: ANIME) {
        lists {
          entries {
            status
            score
            progress
            completedAt { year month day }
            startedAt { year month day }
            media {
              id
              title {
                romaji
                english
              }
              episodes
              duration
              genres
              tags { 
                name 
                rank 
                }
              season
              seasonYear
              format
              coverImage {
                extraLarge
                large
              }
            }
          }
        }
      }
    }
  `;

  const res = await $fetch("https://graphql.anilist.co", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: { query, variables: { userName } },
  });

  return res;
});
