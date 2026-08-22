import { GUIDE_POSTS } from "./posts";

export function relatedGuides(href: string, limit = 6): typeof GUIDE_POSTS[number][] {
  return GUIDE_POSTS.filter((post) => post.href !== href).slice(0, limit);
}

export function relatedGuidesByTerms(terms: string[], href = "", limit = 6): typeof GUIDE_POSTS[number][] {
  const needles = terms.map((item) => item.toLowerCase()).filter(Boolean);
  const ranked = GUIDE_POSTS.filter((post) => post.href !== href).map((post) => {
    const hay = `${post.title} ${post.summary}`.toLowerCase();
    const score = needles.reduce((sum, word) => sum + (hay.includes(word) ? 1 : 0), 0);
    return { post, score };
  });
  ranked.sort((a, b) => b.score - a.score || GUIDE_POSTS.indexOf(a.post) - GUIDE_POSTS.indexOf(b.post));
  const picked = ranked.filter((row) => row.score > 0).map((row) => row.post);
  const rest = ranked.filter((row) => row.score === 0).map((row) => row.post);
  return [...picked, ...rest].slice(0, limit);
}
