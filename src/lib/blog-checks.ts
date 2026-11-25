// ADR 0001 §3 and lecture slides 7–8: one post per team member, each with a different keyword. The blog index calls
// this, so two published posts that share an author or a keyword fail the build. Drafts are left out: a teammate may
// prepare a replacement before the published post is withdrawn.

/** The fields of a post that the check reads; `CollectionEntry<'posts'>` fits it. */
export interface PostForChecks {
  id: string;
  filePath?: string | undefined;
  data: { author: { id: string }; keyword: string; draft?: boolean | undefined };
}

export function assertUniquePosts(posts: readonly PostForChecks[]): void {
  const published = posts.filter((post) => !post.data.draft);
  const problems = [
    ...shared(published, (post) => post.data.author.id).map(
      ([author, files]) =>
        `Autor „${author}” ma więcej niż jeden opublikowany wpis (${files}). Zasada: jeden wpis na członka zespołu.`,
    ),
    ...shared(published, (post) => post.data.keyword).map(
      ([keyword, files]) =>
        `Słowo kluczowe „${keyword}” ma więcej niż jeden opublikowany wpis (${files}). Zasada: każdy wpis ma inne słowo kluczowe.`,
    ),
  ];
  if (problems.length > 0) throw new Error(problems.join('\n'));
}

/** Each value that more than one post has, with the files of those posts. */
function shared(posts: readonly PostForChecks[], valueOf: (post: PostForChecks) => string): [string, string][] {
  return [...Map.groupBy(posts, valueOf)]
    .filter(([, group]) => group.length > 1)
    .map(([value, group]) => [value, group.map((post) => post.filePath ?? post.id).join(', ')]);
}
