// ADR 0001 §3: a post fails the build unless one ## or ### heading contains its keyword. The check runs inside the
// processor that renders the post, on the same parse, so the check and the page cannot disagree.
//
// Astro 7 renders Markdown with Sätteri by default and runs remark plugins only on the optional unified processor
// (`@astrojs/markdown-remark`, not installed). This is therefore a Sätteri mdast plugin, the Sätteri counterpart of
// a remark plugin: `satteri({ mdastPlugins: [remarkKeywordHeading] })`. Sätteri calls it once per document.
import type { Nodes, Root } from 'mdast';
import { KEYWORDS, containsKeyword, type Keyword } from './keywords.ts';

const POSTS_DIR = 'src/content/posts/';

/** The part of Sätteri's per-document factory context that the plugin reads. */
export interface DocumentContext {
  readonly fileURL: URL | undefined;
  /** Astro 7 seeds `astro.frontmatter` here with the post's front matter as parsed from YAML. */
  readonly data: Readonly<Record<string, unknown>>;
}

export interface KeywordHeadingPlugin {
  readonly name: string;
  after(root: Root): void;
}

/** Heading text as the reader sees it, read through emphasis, links and other inline wrappers. */
export function headingText(node: Nodes): string {
  if (node.type === 'text' || node.type === 'inlineCode') return node.value;
  if (node.type === 'break') return ' ';
  // Other leaves are not visible text: inline HTML is only the tags (the text between them is in sibling text
  // nodes), and an image's alt text is not shown.
  if (!('children' in node)) return '';
  let text = '';
  for (const child of node.children) text += headingText(child);
  return text;
}

/** The text of every ## and ### heading, in document order. */
export function subheadings(root: Root): string[] {
  const found: string[] = [];
  const visit = (node: Nodes): void => {
    if (node.type === 'heading') {
      if (node.depth === 2 || node.depth === 3) found.push(headingText(node));
      return;
    }
    if ('children' in node) for (const child of node.children) visit(child);
  };
  visit(root);
  return found;
}

export function assertKeywordHeading(root: Root, keyword: Keyword, path: string): void {
  const headings = subheadings(root);
  if (headings.some((text) => containsKeyword(text, keyword))) return;
  const found =
    headings.length === 0
      ? 'Wpis nie ma śródtytułów ## ani ###.'
      : `Śródtytuły we wpisie: ${headings.map((text) => `„${text}”`).join(', ')}.`;
  throw new Error(
    `${path}: Śródtytuł (## lub ###) musi zawierać słowo kluczowe: „${keyword}”, w tej samej formie, bez odmiany. ${found}`,
  );
}

/** The path of a post relative to the site root, or null when the file is not a post. */
export function postPath(fileURL: URL | undefined): string | null {
  if (fileURL === undefined) return null;
  const path = decodeURIComponent(fileURL.pathname);
  const start = path.lastIndexOf(`/${POSTS_DIR}`);
  return start === -1 ? null : path.slice(start + 1);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function frontmatterKeyword(data: DocumentContext['data']): Keyword | undefined {
  const astro = data.astro;
  const keyword = isRecord(astro) && isRecord(astro.frontmatter) ? astro.frontmatter.keyword : undefined;
  return KEYWORDS.find((known) => known === keyword);
}

/**
 * Returns null for files outside `src/content/posts/`, which leaves the plugin out of their pipeline. The content
 * layer validates the schema before it renders, so a post reaching this point already has a valid `keyword`; the
 * throw below covers a processor that renders posts some other way.
 */
export function remarkKeywordHeading(ctx: DocumentContext): KeywordHeadingPlugin | null {
  const path = postPath(ctx.fileURL);
  if (path === null) return null;
  const keyword = frontmatterKeyword(ctx.data);
  if (keyword === undefined) {
    throw new Error(`${path}: Pole keyword musi być jednym ze słów kluczowych: ${KEYWORDS.join(', ')}.`);
  }
  return { name: 'monsun-keyword-heading', after: (root) => assertKeywordHeading(root, keyword, path) };
}
