/**
 * One ranked list, rendered into an <ol>.
 *
 * The end-of-game card and the Reminders app screen show the same board, so the
 * rows are built in one place rather than twice.
 *
 * Nothing here touches innerHTML. Names come from other players and land on the
 * board verbatim, so the markup is assembled from nodes and the name is only
 * ever set as text — there is no parse step for anyone to aim at.
 */

function span(cls, text) {
  const el = document.createElement('span');
  el.className = cls;
  el.textContent = String(text);
  return el;
}

/**
 * @param {Element} ol   the list to fill; whatever was there is replaced
 * @param {Array<{name: string, score: number}>} top  in board order already
 * @param {{rank?: number|null, name?: string|null}} [you]  which row is yours
 *
 * Highlighting takes two forms. Straight after a submission we know the exact
 * position, so the row has to agree on both rank and name and a namesake
 * further down stays dark. Opened cold from the home screen there's no fresh
 * rank to anchor to — only a remembered name — so the first match wins, which
 * is also the best one, the list being in score order.
 */
export function renderRows(ol, top, you = {}) {
  ol.replaceChildren();
  let lit = false;

  (top ?? []).forEach((row, i) => {
    const li = document.createElement('li');

    const mine = you.rank
      ? i + 1 === you.rank && row.name === you.name
      : !lit && you.name != null && you.name !== '' && row.name === you.name;
    if (mine) {
      li.className = 'me';
      lit = true;
    }

    li.append(span('pos', i + 1), span('who', row.name), span('pts', Number(row.score)));
    ol.appendChild(li);
  });
}
