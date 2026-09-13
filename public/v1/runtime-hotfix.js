/* Miracolo Lab V1 — runtime integrity hotfixes.
   Keep fixes here only when they protect persisted state or cross-module contracts.
*/
(() => {
  'use strict';

  // Learning Bot: approved positions must have an openedAt timestamp or the
  // existing 3-day expiry rule can never trigger.
  if (typeof LearningBot === 'function' && !LearningBot.prototype.__openedAtHotfix) {
    const originalApprove = LearningBot.prototype.approveSuggestion;
    LearningBot.prototype.approveSuggestion = function(id) {
      const result = originalApprove.call(this, id);
      if (result) {
        const position = this.positions[result.sym];
        if (position && !position.openedAt) {
          position.openedAt = result.timestamp || new Date().toISOString();
          const trade = this.trades.find(t => t.type === 'BUY' && t.sym === result.sym && !t.openedAt);
          if (trade) trade.openedAt = position.openedAt;
          this.save();
        }
      }
      return result;
    };

    // Migrate positions persisted by older builds that never wrote openedAt.
    if (typeof BOT !== 'undefined' && BOT?.positions) {
      let changed = false;
      for (const [sym, position] of Object.entries(BOT.positions)) {
        if (position?.openedAt) continue;
        const trade = (BOT.trades || []).find(t => t.type === 'BUY' && t.sym === sym);
        position.openedAt = trade?.time || new Date().toISOString();
        changed = true;
      }
      if (changed) BOT.save();
    }

    LearningBot.prototype.__openedAtHotfix = true;
  }
})();
