import { GUIDE_POSTS } from "./posts";

export function relatedGuides(href: string, limit = 4): typeof GUIDE_POSTS[number][] {
  return GUIDE_POSTS.filter((post) => post.href !== href).slice(0, limit);
}
