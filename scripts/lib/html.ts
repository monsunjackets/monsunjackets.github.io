// A small HTML tokenizer for the site's own build output, used by verify-dist. It is not a general parser
// and builds no tree: it returns start tags (with attributes), end tags and text in document order, which is
// all the checks need. It follows the HTML tokenizer where our output depends on it: comments, doctype and
// CDATA are skipped; <script> and <style> are raw text and <title> and <textarea> are RCDATA, so markup inside
// them is never read as tags; inside <svg> and <math> a <title> is an ordinary element. Node built-ins only.

export interface Attr {
  /** Lower-cased, as browsers see it. */
  name: string;
  /** With character references decoded. */
  value: string;
}

export interface StartTag {
  kind: 'start';
  /** Lower-cased. */
  name: string;
  attrs: Attr[];
  selfClosing: boolean;
  /** Inside <svg> or <math> (or the <svg>/<math> tag itself). */
  foreign: boolean;
}

export interface EndTag {
  kind: 'end';
  name: string;
}

export interface Text {
  kind: 'text';
  /** Source text, not decoded. For <script> and <style> this is exactly what the browser hashes for CSP. */
  text: string;
  /** Name of the raw-text or RCDATA element the text belongs to, if any. */
  parent?: string;
}

export type Token = StartTag | EndTag | Text;

const RAW_TEXT = new Set(['script', 'style']);
const RCDATA = new Set(['title', 'textarea']);
const FOREIGN_ROOTS = new Set(['svg', 'math']);
const WHITESPACE = /[\t\n\f\r ]/;

export function tokenize(html: string): Token[] {
  const tokens: Token[] = [];
  const n = html.length;
  let i = 0;
  let foreignDepth = 0;

  const text = (from: number, to: number, parent?: string) => {
    if (to > from) tokens.push(parent ? { kind: 'text', text: html.slice(from, to), parent } : { kind: 'text', text: html.slice(from, to) });
  };
  const skipPast = (marker: string, from: number) => {
    const end = html.indexOf(marker, from);
    return end === -1 ? n : end + marker.length;
  };

  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      text(i, n);
      break;
    }
    text(i, lt);
    i = lt;
    const next = html[i + 1] ?? '';

    if (html.startsWith('<!--', i)) {
      i = skipPast('-->', i + 4);
    } else if (html.startsWith('<![CDATA[', i)) {
      const end = html.indexOf(']]>', i + 9);
      text(i + 9, end === -1 ? n : end);
      i = end === -1 ? n : end + 3;
    } else if (next === '!' || next === '?') {
      i = skipPast('>', i); // doctype or bogus comment
    } else if (next === '/') {
      const match = /^<\/([a-zA-Z][^\t\n\f\r />]*)[^>]*>?/.exec(html.slice(i, i + 256));
      if (!match) {
        i = skipPast('>', i); // "</" without a tag name: a bogus comment
        continue;
      }
      const name = match[1]!.toLowerCase();
      tokens.push({ kind: 'end', name });
      if (FOREIGN_ROOTS.has(name) && foreignDepth > 0) foreignDepth -= 1;
      i = match[0].endsWith('>') ? i + match[0].length : skipPast('>', i);
    } else if (/[a-zA-Z]/.test(next)) {
      const tag = readStartTag(html, i);
      if (!tag) break; // the file ends inside a tag; browsers drop it
      const foreign = foreignDepth > 0 || FOREIGN_ROOTS.has(tag.name);
      tokens.push({ kind: 'start', name: tag.name, attrs: tag.attrs, selfClosing: tag.selfClosing, foreign });
      i = tag.end;
      if (FOREIGN_ROOTS.has(tag.name) && !tag.selfClosing) foreignDepth += 1;
      const rawText = RAW_TEXT.has(tag.name) && !(foreign && tag.selfClosing);
      const rcdata = RCDATA.has(tag.name) && !foreign;
      if (rawText || rcdata) {
        const close = new RegExp(`</${tag.name}[\\t\\n\\f\\r />]`, 'gi');
        close.lastIndex = i;
        const found = close.exec(html);
        const end = found ? found.index : n;
        text(i, end, tag.name);
        tokens.push({ kind: 'end', name: tag.name });
        i = found ? skipPast('>', end) : n;
      }
    } else {
      text(i, i + 1); // a lone "<" is text
      i += 1;
    }
  }
  return tokens;
}

function readStartTag(html: string, start: number): { name: string; attrs: Attr[]; selfClosing: boolean; end: number } | null {
  const n = html.length;
  let i = start + 1;
  while (i < n && !WHITESPACE.test(html[i]!) && html[i] !== '/' && html[i] !== '>') i += 1;
  const name = html.slice(start + 1, i).toLowerCase();
  const attrs: Attr[] = [];
  let selfClosing = false;

  while (i < n) {
    const c = html[i]!;
    if (WHITESPACE.test(c)) {
      i += 1;
      continue;
    }
    if (c === '>') return { name, attrs, selfClosing, end: i + 1 };
    if (c === '/') {
      selfClosing = html[i + 1] === '>';
      i += 1;
      continue;
    }
    selfClosing = false;
    const nameStart = i;
    i += 1; // the first character may be "=" (an odd attribute name, but a name)
    while (i < n && !WHITESPACE.test(html[i]!) && html[i] !== '/' && html[i] !== '>' && html[i] !== '=') i += 1;
    const attrName = html.slice(nameStart, i).toLowerCase();
    let j = i;
    while (j < n && WHITESPACE.test(html[j]!)) j += 1;
    let value = '';
    if (html[j] === '=') {
      j += 1;
      while (j < n && WHITESPACE.test(html[j]!)) j += 1;
      const quote = html[j];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, j + 1);
        if (close === -1) return null;
        value = html.slice(j + 1, close);
        i = close + 1;
      } else {
        const valueStart = j;
        while (j < n && !WHITESPACE.test(html[j]!) && html[j] !== '>') j += 1;
        value = html.slice(valueStart, j);
        i = j;
      }
    }
    attrs.push({ name: attrName, value: decodeEntities(value) });
  }
  return null;
}

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Decodes numeric character references and the few named ones that appear in generated HTML. */
export function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  // Named references need the semicolon here: in attributes, browsers leave "&lt=" and the like as they are.
  return value.replace(/&(?:#([xX][0-9a-fA-F]+|[0-9]+);?|([a-zA-Z]+);)/g, (whole, num?: string, name?: string) => {
    if (num !== undefined) {
      const code = num[0] === 'x' || num[0] === 'X' ? parseInt(num.slice(1), 16) : parseInt(num, 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '�';
    }
    return NAMED[name!] ?? whole;
  });
}

/** The value of the first attribute with this name, as browsers use it; undefined when absent. */
export function attr(tag: StartTag, name: string): string | undefined {
  return tag.attrs.find((a) => a.name === name)?.value;
}

/** A short, safe rendering of a start tag for error messages. */
export function describeTag(tag: StartTag, ...names: string[]): string {
  const shown = tag.attrs
    .filter((a) => names.includes(a.name))
    .map((a) => ` ${a.name}="${a.value.length > 80 ? `${a.value.slice(0, 77)}...` : a.value}"`);
  return `<${tag.name}${shown.join('')}>`;
}
