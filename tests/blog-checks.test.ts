import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertUniquePosts, type PostForChecks } from '../src/lib/blog-checks.ts';

const post = (slug: string, author: string, keyword: string, draft = false): PostForChecks => ({
  id: slug,
  filePath: `src/content/posts/${slug}.md`,
  data: { author: { id: author }, keyword, draft },
});

const team = [
  post('kurtka-skorzana-na-zime', 'milosz', 'kurtka skórzana na zimę'),
  post('jak-dobrac-rozmiar-kurtki-skorzanej', 'filip', 'jak dobrać rozmiar kurtki skórzanej'),
  post('jak-dbac-o-kurtke-skorzana', 'nishanth', 'jak dbać o kurtkę skórzaną'),
];

test('passes when every published post has its own author and keyword', () => {
  assertUniquePosts(team);
});

test('fails when two published posts share an author, naming both files and the rule', () => {
  const second = post('ramoneska-skorzana', 'milosz', 'ramoneska skórzana');
  assert.throws(() => assertUniquePosts([...team, second]), {
    message:
      'Autor „milosz” ma więcej niż jeden opublikowany wpis (src/content/posts/kurtka-skorzana-na-zime.md, ' +
      'src/content/posts/ramoneska-skorzana.md). Zasada: jeden wpis na członka zespołu.',
  });
});

test('fails when two published posts share a keyword, naming both files and the rule', () => {
  const second = post('zimowa-kurtka', 'gosc', 'kurtka skórzana na zimę');
  assert.throws(() => assertUniquePosts([...team, second]), {
    message:
      'Słowo kluczowe „kurtka skórzana na zimę” ma więcej niż jeden opublikowany wpis ' +
      '(src/content/posts/kurtka-skorzana-na-zime.md, src/content/posts/zimowa-kurtka.md). ' +
      'Zasada: każdy wpis ma inne słowo kluczowe.',
  });
});

test('reports every broken rule at once', () => {
  const copy = post('kurtka-skorzana-na-zime-2', 'milosz', 'kurtka skórzana na zimę');
  assert.throws(() => assertUniquePosts([...team, copy]), (error: Error) => {
    const lines = error.message.split('\n');
    return lines.length === 2 && lines[0].startsWith('Autor „milosz”') && lines[1].startsWith('Słowo kluczowe');
  });
});

test('ignores drafts', () => {
  const draft = post('kurtka-skorzana-na-zime-v2', 'milosz', 'kurtka skórzana na zimę', true);
  assertUniquePosts([...team, draft]);
});

test('names a post by its id when it has no file path', () => {
  const second: PostForChecks = { id: 'bez-pliku', data: { author: { id: 'filip' }, keyword: 'ramoneska skórzana' } };
  assert.throws(() => assertUniquePosts([...team, second]), /\(src\/content\/posts\/jak-dobrac[^)]*\.md, bez-pliku\)/);
});
