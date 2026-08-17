import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * A DOM small enough to fit in the file that uses it.
 *
 * This project has no dependencies and `npm test` is a bare `node --test`;
 * pulling in jsdom to check the order of eight list items would be the largest
 * thing in the repo. renderRows builds nodes and sets text — it never parses
 * markup — so a stub with append and textContent covers everything it does.
 */
function fakeDom() {
  const make = (tagName) => ({
    tagName,
    className: '',
    textContent: '',
    children: [],
    append(...kids) { this.children.push(...kids); },
    appendChild(kid) { this.children.push(kid); return kid; },
    replaceChildren(...kids) { this.children = kids; },
  });
  globalThis.document = { createElement: make };
  return make('ol');
}

const ol = fakeDom();
const { renderRows } = await import('../js/board.js');

/** ['1 cw 15', ...] — flattens a rendered row to something readable. */
const rows = (list) => list.children.map((li) => li.children.map((s) => s.textContent).join(' '));
const litRow = (list) => list.children.findIndex((li) => li.className === 'me');

const TOP = [
  { name: 'cw', score: 15 },
  { name: 'cd', score: 6 },
  { name: 'ana', score: 6 },
];

test('renders every row, numbered from one, in the order given', () => {
  const list = fakeDom();
  renderRows(list, TOP);
  assert.deepEqual(rows(list), ['1 cw 15', '2 cd 6', '3 ana 6']);
});

test('nothing is highlighted when we do not know who you are', () => {
  const list = fakeDom();
  renderRows(list, TOP);
  assert.equal(litRow(list), -1);
});

test('a fresh submission highlights the row at that exact rank', () => {
  const list = fakeDom();
  renderRows(list, TOP, { rank: 2, name: 'cd' });
  assert.equal(litRow(list), 1);
});

test('a namesake at another position is left dark', () => {
  const list = fakeDom();
  // you are the 'cd' at rank 2; the name also appears at rank 1
  renderRows(list, [{ name: 'cd', score: 20 }, { name: 'cd', score: 6 }], { rank: 2, name: 'cd' });
  assert.equal(litRow(list), 1);
});

test('opened cold, a remembered name highlights its best row only', () => {
  const list = fakeDom();
  renderRows(list, [{ name: 'cd', score: 20 }, { name: 'cd', score: 6 }], { name: 'cd' });
  assert.equal(litRow(list), 0);
  assert.equal(list.children.filter((li) => li.className === 'me').length, 1);
});

test('an empty remembered name highlights nothing', () => {
  const list = fakeDom();
  renderRows(list, TOP, { name: '' });
  assert.equal(litRow(list), -1);
});

test('an empty board renders no rows', () => {
  const list = fakeDom();
  renderRows(list, []);
  assert.deepEqual(list.children, []);
});

test('a missing board is treated as empty rather than throwing', () => {
  const list = fakeDom();
  renderRows(list, null);
  assert.deepEqual(list.children, []);
});

test('rendering twice replaces the rows instead of stacking them', () => {
  const list = fakeDom();
  renderRows(list, TOP);
  renderRows(list, [{ name: 'solo', score: 1 }]);
  assert.deepEqual(rows(list), ['1 solo 1']);
});

test('a name containing markup stays text', () => {
  const list = fakeDom();
  renderRows(list, [{ name: '<img src=x onerror=alert(1)>', score: 3 }]);
  const who = list.children[0].children[1];
  // set as text on its own node — there is no markup parse anywhere in the path
  assert.equal(who.textContent, '<img src=x onerror=alert(1)>');
  assert.deepEqual(who.children, []);
});

test('a non-numeric score is coerced rather than passed through', () => {
  const list = fakeDom();
  renderRows(list, [{ name: 'cw', score: '15' }]);
  assert.equal(rows(list)[0], '1 cw 15');
});
