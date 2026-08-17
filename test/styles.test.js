import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * The panels that only exist at runtime.
 *
 * #uvy, #dials and #install are built by their modules and appended to <body>,
 * so nothing in index.html mentions them and no amount of reading the markup
 * will tell you their styles went missing. That is exactly how it happened: a
 * rewrite of the install section took the two easter-egg blocks out with it,
 * and both kept "working" — handlers ran, elements landed in the DOM — while
 * rendering as unstyled blocks behind the fixed home screen. Invisible.
 *
 * These tests read the class names straight out of each module, so a panel
 * that grows a new element is covered without anyone remembering to come here.
 */

const read = (p) => readFileSync(fileURLToPath(new URL(`../${p}`, import.meta.url)), 'utf8');
const css = read('css/styles.css');

/** Every class="..." token a module writes into its markup. */
function classesIn(src) {
  const found = new Set();
  for (const [, list] of src.matchAll(/class="([^"$]+)"/g)) {
    for (const c of list.trim().split(/\s+/)) found.add(c);
  }
  return [...found];
}

/** A rule for `.foo` anywhere in the sheet, scoped or not, but not `.foo-bar`. */
const styles = (sel) => new RegExp(`\\${sel}(?![\\w-])`).test(css);

const PANELS = [
  { id: 'uvy',     src: 'js/uvy.js' },
  { id: 'dials',   src: 'js/dials.js' },
  { id: 'install', src: 'js/install.js' },
];

for (const { id, src } of PANELS) {
  test(`#${id} has a layout rule`, () => {
    assert.match(css, new RegExp(`^#${id}\\s*\\{`, 'm'),
      `#${id} is appended to <body> by ${src}. With no rule it renders as a static ` +
      `block at the end of the document, behind the fixed home screen.`);
  });

  // These panels set display:flex on the root, which outranks the user agent's
  // [hidden] { display: none }. Losing this line leaves the panel permanently on.
  test(`#${id} restates [hidden]`, () => {
    assert.match(css, new RegExp(`^#${id}\\[hidden\\]`, 'm'),
      `#${id} sets display on its root, so it must re-hide itself explicitly.`);
  });

  test(`every class in ${src} is styled`, () => {
    const missing = classesIn(read(src)).filter((c) => !styles(`.${c}`));
    assert.deepEqual(missing, [],
      `${src} renders these classes but the stylesheet has no rule for them: ${missing.join(', ')}`);
  });
}
