/* Free Play best-move arrows: a green arrow for the best move in the shown position,
   and an orange arrow for what was better when the last move was a mistake. */
(() => {
  'use strict';
  const MISTAKE_CP = 120;
  const cp = (r) => (r.mate != null ? Math.sign(r.mate) * (10000 - Math.abs(r.mate) * 100) : r.score || 0);
  const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4) });

  class FreeHints {
    constructor() { this.cache = new Map(); this.engine = null; this.queue = Promise.resolve(); this.serial = 0; }
    get on() { return document.getElementById('freeHints')?.checked; }

    async analyse(fen) {
      if (this.cache.has(fen)) return this.cache.get(fen);
      if (!this.engine) { this.engine = new StockfishEngine('free-hints'); await this.engine.init(); }
      const r = await this.engine.evaluate(fen, 12, 500);
      const out = { best: r.bestMove, cp: cp(r) };
      this.cache.set(fen, out);
      return out;
    }

    update(fp) {
      const note = document.getElementById('freeHintNote');
      if (!this.on || fp.busy || fp.pending) { note.textContent = ''; return; }
      const fen = fp.positions[fp.index], prev = fp.positions[fp.index - 1], last = fp.moves[fp.index - 1];
      const serial = ++this.serial;
      // Serialize searches on one engine; drop results for positions no longer shown.
      this.queue = this.queue.then(async () => {
        if (serial !== this.serial) return;
        try {
          const now = await this.analyse(fen);
          const before = prev ? await this.analyse(prev) : null;
          if (serial !== this.serial || fp.positions[fp.index] !== fen) return;
          this.draw(fp, now, before, last);
        } catch (_) { note.textContent = 'Best-move arrows are unavailable right now.'; }
      });
    }

    draw(fp, now, before, last) {
      const arrows = [], note = document.getElementById('freeHintNote');
      let text = '';
      const playedUci = last && last.from + last.to + (last.promotion || '');
      // Scores are from the side to move, so the mover's loss is their best minus the opponent's score negated.
      const loss = before && last ? before.cp + now.cp : 0;
      if (before?.best && playedUci !== before.best && loss >= MISTAKE_CP) {
        const better = new Chess(fp.positions[fp.index - 1]).move({ ...uci(before.best), promotion: before.best[4] });
        arrows.push({ ...uci(before.best), color: 'warn' });
        text = `${last.san} was a ${loss >= 300 ? 'blunder' : 'mistake'}. Orange arrow: ${better ? better.san : before.best} was better.`;
      }
      if (now.best) {
        arrows.push({ ...uci(now.best), color: 'best' });
        text += `${text ? ' ' : ''}Green arrow: best move now.`;
      }
      const board = document.getElementById('freeBoard');
      board.querySelector('.tc-arrows')?.remove();
      board.append(BoardView.prototype.arrowLayer.call({ flipped: fp.flipped, center: BoardView.prototype.center }, arrows));
      note.textContent = text;
    }
  }
  window.freeHints = new FreeHints();
  document.addEventListener('change', (e) => { if (e.target.id === 'freeHints' && window.freePlay) window.freePlay.render(); });
})();
