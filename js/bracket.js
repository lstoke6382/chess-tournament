// =====================================================
// BRACKET MODULE
// Handles single elimination and double elimination
// bracket generation, rendering, board scheduling,
// and result submission.
// =====================================================

// =====================================================
// SINGLE ELIMINATION - BRACKET GENERATION
// =====================================================
function generateBracket(playerCount) {
  let bracketSize = 1;
  while (bracketSize < playerCount) bracketSize *= 2;

  const totalRounds = Math.log2(bracketSize);
  let matchIndex = 0;
  const bracket = [];

  // First round matches
  for (let i = 0; i < bracketSize; i += 2) {
    const p1 = i < playerCount ? i : null;
    const p2 = i + 1 < playerCount ? i + 1 : null;
    const winner = (p1 !== null && p2 === null) ? p1 : (p2 !== null && p1 === null) ? p2 : null;
    bracket.push({ round: 0, matchIndex: matchIndex++, player1: p1, player2: p2, winner });
  }

  // Subsequent rounds (empty slots)
  for (let r = 1; r < totalRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1);
    for (let m = 0; m < matchesInRound; m++) {
      bracket.push({ round: r, matchIndex: matchIndex++, player1: null, player2: null, winner: null });
    }
  }

  advanceBracketByes(bracket, totalRounds);
  return bracket;
}

function advanceBracketByes(bracket, totalRounds) {
  for (let r = 0; r < totalRounds; r++) {
    const roundMatches = bracket.filter(m => m.round === r);
    const nextRoundMatches = bracket.filter(m => m.round === r + 1);
    if (nextRoundMatches.length === 0) break;

    for (let i = 0; i < roundMatches.length; i++) {
      const match = roundMatches[i];
      if (match.winner === null) continue;
      const nextMatchIdx = Math.floor(i / 2);
      if (nextMatchIdx >= nextRoundMatches.length) continue;
      const nextMatch = nextRoundMatches[nextMatchIdx];
      if (i % 2 === 0) { nextMatch.player1 = match.winner; }
      else { nextMatch.player2 = match.winner; }
    }

    // After placing winners, check for auto-advances in the next round
    // (where one player is set but the other is still null due to double-bye)
    for (const nextMatch of nextRoundMatches) {
      if (nextMatch.winner !== null) continue;
      if (nextMatch.player1 !== null && nextMatch.player2 === null) {
        nextMatch.winner = nextMatch.player1;
      } else if (nextMatch.player2 !== null && nextMatch.player1 === null) {
        nextMatch.winner = nextMatch.player2;
      }
    }
  }
}

// =====================================================
// DOUBLE ELIMINATION - BRACKET GENERATION
// =====================================================
function generateDoubleEliminationBracket(playerCount) {
  let bracketSize = 1;
  while (bracketSize < playerCount) bracketSize *= 2;
  const wbRounds = Math.log2(bracketSize);

  let matchIndex = 0;
  const winners = [];
  const losers = [];
  const grandFinal = [];

  // --- WINNERS BRACKET ---
  // Round 0: first round
  for (let i = 0; i < bracketSize; i += 2) {
    const p1 = i < playerCount ? i : null;
    const p2 = i + 1 < playerCount ? i + 1 : null;
    const winner = (p1 !== null && p2 === null) ? p1 : (p2 !== null && p1 === null) ? p2 : null;
    winners.push({ round: 0, matchIndex: matchIndex++, player1: p1, player2: p2, winner, bracket: 'winners' });
  }

  // Subsequent winners rounds
  for (let r = 1; r < wbRounds; r++) {
    const matchesInRound = bracketSize / Math.pow(2, r + 1);
    for (let m = 0; m < matchesInRound; m++) {
      winners.push({ round: r, matchIndex: matchIndex++, player1: null, player2: null, winner: null, bracket: 'winners' });
    }
  }

  // Advance byes in winners bracket
  advanceBracketByes(winners, wbRounds);

  // --- LOSERS BRACKET ---
  // Losers bracket has (2 * wbRounds - 1) rounds
  // Odd-indexed LB rounds (0, 2, 4...) are "feed-in" rounds where WB losers drop in
  // Even-indexed LB rounds (1, 3, 5...) are "reduction" rounds
  const lbRounds = 2 * (wbRounds - 1);

  for (let lr = 0; lr < lbRounds; lr++) {
    let matchesInRound;
    if (lr === 0) {
      // LR0: WB R0 losers play each other
      matchesInRound = bracketSize / 4;
    } else if (lr % 2 === 1) {
      // Reduction round: same count as previous round's output
      const prevRoundMatches = losers.filter(m => m.round === lr - 1);
      matchesInRound = prevRoundMatches.length;
    } else {
      // Feed-in round: previous round survivors face new WB losers
      const prevRoundMatches = losers.filter(m => m.round === lr - 1);
      matchesInRound = prevRoundMatches.length;
      // This can halve if the feed-in round combines with reduction
      // Actually for feed-in: number of matches = number from prev reduction round
      // which equals number of WB losers dropping in from the corresponding WB round
    }

    // Recalculate more carefully
    // LR0: bracketSize/4 matches (half of WB R0 losers paired up)
    // LR1: bracketSize/4 matches (LR0 winners vs WB R1 losers) - but WB R1 has bracketSize/4 matches producing bracketSize/4 losers
    //   Wait, LR1 is reduction: LR0 survivors play each other? No...
    //   Let me reconsider the structure.

    // Actually the standard pattern for double elimination:
    // LR0 (feed-in from WB R0): bracketSize/4 matches
    // LR1 (feed-in from WB R1 into LR0 survivors): bracketSize/4 matches
    // LR2 (reduction): bracketSize/8 matches
    // LR3 (feed-in from WB R2): bracketSize/8 matches
    // LR4 (reduction): bracketSize/16 matches
    // etc.

    // Let me just generate the right number based on this pattern
    break; // We'll handle this below
  }

  // Clear losers and regenerate properly
  losers.length = 0;
  generateLosersRounds(losers, winners, wbRounds, bracketSize, matchIndex);
  matchIndex = losers.length > 0 ? Math.max(...losers.map(m => m.matchIndex)) + 1 : matchIndex;

  // --- GRAND FINAL ---
  grandFinal.push({
    round: 0, matchIndex: matchIndex++,
    player1: null, player2: null, winner: null,
    bracket: 'grand_final', label: 'Grand Final'
  });
  // Reset match (only played if LB champion wins GF1)
  grandFinal.push({
    round: 1, matchIndex: matchIndex++,
    player1: null, player2: null, winner: null,
    bracket: 'grand_final', label: 'Grand Final Reset'
  });

  return { winners, losers, grandFinal, bracketSize, wbRounds };
}

function generateLosersRounds(losers, winners, wbRounds, bracketSize, startMatchIndex) {
  let matchIndex = startMatchIndex;
  const lbRounds = 2 * (wbRounds - 1);

  // Calculate matches per LB round
  // Pattern: The LB alternates between feed-in and reduction
  // LR0: bracketSize/4 (WB R0 losers paired, cross-seeded)
  // LR1: bracketSize/4 (LR0 winners vs WB R1 losers)
  // LR2: bracketSize/8 (LR1 winners paired - reduction)
  // LR3: bracketSize/8 (LR2 winners vs WB R2 losers)
  // LR4: bracketSize/16 (LR3 winners paired - reduction)
  // ...

  let currentMatchCount = bracketSize / 4;

  for (let lr = 0; lr < lbRounds; lr++) {
    let matchesThisRound;

    if (lr === 0) {
      // First LB round: WB R0 losers face each other
      matchesThisRound = bracketSize / 4;
    } else if (lr % 2 === 1) {
      // Odd LB rounds: feed-in from WB (LB survivors vs WB losers dropping down)
      // Same count as previous round
      matchesThisRound = currentMatchCount;
    } else {
      // Even LB rounds (2,4,6...): reduction (halve the count)
      currentMatchCount = currentMatchCount / 2;
      matchesThisRound = currentMatchCount;
    }

    for (let m = 0; m < matchesThisRound; m++) {
      losers.push({
        round: lr,
        matchIndex: matchIndex++,
        player1: null,
        player2: null,
        winner: null,
        bracket: 'losers',
        // Track which WB round feeds into this LB round (for feed-in rounds)
        feedFromWBRound: lr === 0 ? 0 : (lr % 2 === 1 ? Math.floor(lr / 2) + 1 : null)
      });
    }
  }

  // Auto-advance byes in losers bracket
  // First, seed LB R0 with WB R0 losers (cross-seeded for anti-rematch)
  const wbR0 = winners.filter(m => m.round === 0);
  const lbR0 = losers.filter(m => m.round === 0);

  // Cross-seed: pair losers from opposite ends of WB R0
  for (let i = 0; i < lbR0.length; i++) {
    const topLoserMatch = wbR0[i];
    const bottomLoserMatch = wbR0[wbR0.length - 1 - i];
    if (topLoserMatch && topLoserMatch.winner !== null && topLoserMatch.player1 !== null && topLoserMatch.player2 !== null) {
      const loser = topLoserMatch.winner === topLoserMatch.player1 ? topLoserMatch.player2 : topLoserMatch.player1;
      lbR0[i].player1 = loser;
    }
    if (bottomLoserMatch && bottomLoserMatch.winner !== null && bottomLoserMatch.player1 !== null && bottomLoserMatch.player2 !== null) {
      const loser = bottomLoserMatch.winner === bottomLoserMatch.player1 ? bottomLoserMatch.player2 : bottomLoserMatch.player1;
      lbR0[i].player2 = loser;
    }
  }

  // Handle byes: if a WB R0 match was a bye, the loser is null (no one lost)
  // We need to handle this for the LB seeding
  for (let i = 0; i < lbR0.length; i++) {
    const m = lbR0[i];
    if (m.player1 !== null && m.player2 === null) {
      m.winner = m.player1; // auto-advance
    } else if (m.player2 !== null && m.player1 === null) {
      m.winner = m.player2;
    }
  }
}


// =====================================================
// ROUND NAMING
// =====================================================
function getEliminationRoundName(round, totalRounds) {
  const remaining = totalRounds - round;
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semifinals';
  if (remaining === 3) return 'Quarterfinals';
  if (remaining === 4) return 'Round of 16';
  if (remaining === 5) return 'Round of 32';
  return `Round ${round + 1}`;
}

function getLBRoundName(lbRound, totalLBRounds) {
  if (lbRound === totalLBRounds - 1) return 'Losers Final';
  if (lbRound === totalLBRounds - 2) return 'Losers Semifinal';
  return `Losers Round ${lbRound + 1}`;
}


// =====================================================
// BOARD SCHEDULING FOR ELIMINATION
// =====================================================
// Uses a dependency DAG approach: a match is "ready" when
// both players are determined and no board is currently assigned to it.

function getReadyMatches(bracket, boardState) {
  const assignedMatchIndices = new Set();
  if (boardState) {
    Object.values(boardState).forEach(bs => {
      if (bs && bs.matchIndex !== undefined && bs.matchIndex !== null) {
        assignedMatchIndices.add(bs.matchIndex);
      }
    });
  }

  const bracketArr = Array.isArray(bracket) ? bracket : Object.values(bracket || {});
  return bracketArr.filter(m =>
    m.player1 !== null && m.player1 !== undefined &&
    m.player2 !== null && m.player2 !== undefined &&
    m.winner === null &&
    !assignedMatchIndices.has(m.matchIndex)
  );
}

function assignMatchesToBoards(bracket, boardState, numBoards) {
  const ready = getReadyMatches(bracket, boardState);
  const newBoardState = { ...boardState };
  let changed = false;

  for (let b = 0; b < numBoards; b++) {
    const bs = newBoardState[b];
    // If board is idle and there are ready matches
    if ((!bs || bs === null || bs.matchIndex === undefined || bs.matchIndex === null) && ready.length > 0) {
      const match = ready.shift();
      newBoardState[b] = { matchIndex: match.matchIndex };
      changed = true;
    }
  }

  return changed ? newBoardState : null;
}

function initializeBoardState(bracket, numBoards) {
  const boardState = {};
  const ready = getReadyMatches(bracket, null);

  for (let b = 0; b < numBoards; b++) {
    if (b < ready.length) {
      boardState[b] = { matchIndex: ready[b].matchIndex };
    } else {
      boardState[b] = null;
    }
  }

  return boardState;
}


// =====================================================
// RENDER: SINGLE ELIMINATION BRACKET (visual tree)
// =====================================================
function renderSingleEliminationBracket(container, data, players, isDirector, callbacks) {
  container.innerHTML = '';

  if (!data.bracket) return;
  const bracket = Array.isArray(data.bracket) ? data.bracket : Object.values(data.bracket);

  let bracketSize = 1;
  while (bracketSize < players.length) bracketSize *= 2;
  const totalRounds = Math.log2(bracketSize);

  const boardState = data.boardState || {};

  // Build a map of matchIndex -> board number
  const matchToBoard = {};
  Object.entries(boardState).forEach(([b, bs]) => {
    if (bs && bs.matchIndex !== undefined && bs.matchIndex !== null) {
      matchToBoard[bs.matchIndex] = parseInt(b);
    }
  });

  // Create bracket tree
  const tree = document.createElement('div');
  tree.className = 'bracket-tree';

  for (let r = 0; r < totalRounds; r++) {
    const col = document.createElement('div');
    col.className = 'bracket-round-col';
    col.dataset.round = r;

    // Round header
    const header = document.createElement('div');
    header.className = 'bracket-round-header';
    header.textContent = getEliminationRoundName(r, totalRounds);
    col.appendChild(header);

    const roundMatches = bracket.filter(m => m.round === r);
    roundMatches.forEach(match => {
      const wrap = document.createElement('div');
      wrap.className = 'bracket-match-wrap';

      const card = createMatchCard(match, players, isDirector, matchToBoard, callbacks);
      wrap.appendChild(card);
      col.appendChild(wrap);
    });

    tree.appendChild(col);
  }

  // Wrap in scrollable container
  const wrapper = document.createElement('div');
  wrapper.className = 'bracket-wrapper';
  wrapper.appendChild(tree);

  // Add connector lines via JS (after render)
  container.appendChild(wrapper);

  // Draw connectors after DOM is ready
  requestAnimationFrame(() => drawConnectors(tree, totalRounds));
}


// =====================================================
// RENDER: DOUBLE ELIMINATION BRACKET
// =====================================================
function renderDoubleEliminationBracket(container, data, players, isDirector, callbacks) {
  container.innerHTML = '';

  if (!data.winners && !data.bracket) return;

  // For double elim, data should have: winners, losers, grandFinal
  const winners = data.winners ? (Array.isArray(data.winners) ? data.winners : Object.values(data.winners)) : [];
  const losersData = data.losers ? (Array.isArray(data.losers) ? data.losers : Object.values(data.losers)) : [];
  const grandFinalData = data.grandFinal ? (Array.isArray(data.grandFinal) ? data.grandFinal : Object.values(data.grandFinal)) : [];

  const boardState = data.boardState || {};
  const matchToBoard = {};
  Object.entries(boardState).forEach(([b, bs]) => {
    if (bs && bs.matchIndex !== undefined && bs.matchIndex !== null) {
      matchToBoard[bs.matchIndex] = parseInt(b);
    }
  });

  let bracketSize = 1;
  while (bracketSize < players.length) bracketSize *= 2;
  const wbRounds = Math.log2(bracketSize);

  const doubleElimContainer = document.createElement('div');
  doubleElimContainer.className = 'double-elim-container';

  // --- Winners Bracket ---
  const winnersSection = document.createElement('div');
  winnersSection.className = 'bracket-section';
  const winnersLabel = document.createElement('div');
  winnersLabel.className = 'bracket-section-label winners';
  winnersLabel.textContent = 'Winners Bracket';
  winnersSection.appendChild(winnersLabel);

  const winnersTree = document.createElement('div');
  winnersTree.className = 'bracket-tree';

  for (let r = 0; r < wbRounds; r++) {
    const col = document.createElement('div');
    col.className = 'bracket-round-col';
    col.dataset.round = r;

    const header = document.createElement('div');
    header.className = 'bracket-round-header';
    header.textContent = r === wbRounds - 1 ? 'Winners Final' : getEliminationRoundName(r, wbRounds);
    col.appendChild(header);

    const roundMatches = winners.filter(m => m.round === r);
    roundMatches.forEach(match => {
      const wrap = document.createElement('div');
      wrap.className = 'bracket-match-wrap';
      wrap.appendChild(createMatchCard(match, players, isDirector, matchToBoard, callbacks));
      col.appendChild(wrap);
    });

    winnersTree.appendChild(col);
  }

  const winnersWrapper = document.createElement('div');
  winnersWrapper.className = 'bracket-wrapper';
  winnersWrapper.appendChild(winnersTree);
  winnersSection.appendChild(winnersWrapper);
  doubleElimContainer.appendChild(winnersSection);

  // --- Losers Bracket ---
  if (losersData.length > 0) {
    const losersSection = document.createElement('div');
    losersSection.className = 'bracket-section';
    const losersLabel = document.createElement('div');
    losersLabel.className = 'bracket-section-label losers';
    losersLabel.textContent = 'Losers Bracket';
    losersSection.appendChild(losersLabel);

    const lbRounds = 2 * (wbRounds - 1);
    const losersTree = document.createElement('div');
    losersTree.className = 'bracket-tree';

    for (let lr = 0; lr < lbRounds; lr++) {
      const col = document.createElement('div');
      col.className = 'bracket-round-col';
      col.dataset.round = lr;

      const header = document.createElement('div');
      header.className = 'bracket-round-header';
      header.textContent = getLBRoundName(lr, lbRounds);
      col.appendChild(header);

      const roundMatches = losersData.filter(m => m.round === lr);
      roundMatches.forEach(match => {
        const wrap = document.createElement('div');
        wrap.className = 'bracket-match-wrap';
        wrap.appendChild(createMatchCard(match, players, isDirector, matchToBoard, callbacks));
        col.appendChild(wrap);
      });

      losersTree.appendChild(col);
    }

    const losersWrapper = document.createElement('div');
    losersWrapper.className = 'bracket-wrapper';
    losersWrapper.appendChild(losersTree);
    losersSection.appendChild(losersWrapper);
    doubleElimContainer.appendChild(losersSection);
  }

  // --- Grand Final ---
  if (grandFinalData.length > 0) {
    const gfSection = document.createElement('div');
    gfSection.className = 'bracket-section grand-final-section';
    const gfLabel = document.createElement('div');
    gfLabel.className = 'bracket-section-label grand-final';
    gfLabel.textContent = 'Grand Final';
    gfSection.appendChild(gfLabel);

    grandFinalData.forEach(match => {
      if (match.label === 'Grand Final Reset') {
        // Only show reset if GF1 was won by LB champion
        const gf1 = grandFinalData.find(m => m.label === 'Grand Final');
        if (!gf1 || gf1.winner === null || gf1.winner === undefined) {
          // GF1 not played yet, don't show reset
          return;
        }
        // Check if LB champion won GF1
        // GF1.player2 is the LB champion (by convention)
        if (gf1.winner !== gf1.player2) {
          // WB champion won, no reset needed
          return;
        }
        const resetLabel = document.createElement('div');
        resetLabel.className = 'reset-label';
        resetLabel.textContent = 'Bracket Reset — both players have 1 loss';
        gfSection.appendChild(resetLabel);
      } else {
        const gfLabel2 = document.createElement('div');
        gfLabel2.className = 'grand-final-label';
        gfLabel2.textContent = match.label || 'Grand Final';
        gfSection.appendChild(gfLabel2);
      }

      const card = createMatchCard(match, players, isDirector, matchToBoard, callbacks);
      gfSection.appendChild(card);
    });

    doubleElimContainer.appendChild(gfSection);
  }

  container.appendChild(doubleElimContainer);

  // Draw connectors
  requestAnimationFrame(() => {
    drawConnectors(winnersTree, wbRounds);
    if (losersData.length > 0) {
      const losersTreeEl = container.querySelector('.bracket-section:nth-child(2) .bracket-tree');
      if (losersTreeEl) {
        const lbRounds = 2 * (wbRounds - 1);
        drawConnectors(losersTreeEl, lbRounds);
      }
    }
  });
}


// =====================================================
// CREATE MATCH CARD (shared between single/double)
// =====================================================
function createMatchCard(match, players, isDirector, matchToBoard, callbacks) {
  const card = document.createElement('div');
  const isBye = (match.player1 !== null && match.player2 === null) ||
                (match.player2 !== null && match.player1 === null);
  const hasWinner = match.winner !== null && match.winner !== undefined;
  const isReady = match.player1 !== null && match.player1 !== undefined &&
                  match.player2 !== null && match.player2 !== undefined && !hasWinner;

  let cardClass = 'bracket-match-card';
  if (isBye) cardClass += ' match-bye';
  else if (hasWinner) cardClass += ' match-complete';
  else if (isReady) cardClass += ' match-active';
  card.className = cardClass;

  // Board label
  const boardNum = matchToBoard[match.matchIndex];
  if (boardNum !== undefined && !hasWinner) {
    const boardLabel = document.createElement('div');
    boardLabel.className = 'match-board-label';
    boardLabel.textContent = `Board ${boardNum + 1}`;
    card.appendChild(boardLabel);
  }

  // Player 1 row
  const p1Row = createPlayerRow(match.player1, match, players, hasWinner, 1);
  card.appendChild(p1Row);

  // Player 2 row
  const p2Row = createPlayerRow(match.player2, match, players, hasWinner, 2);
  card.appendChild(p2Row);

  // Actions (director only, match ready)
  if (isReady && !isBye && isDirector) {
    const actions = document.createElement('div');
    actions.className = 'match-actions';

    const p1Name = players[match.player1] || 'TBD';
    const p2Name = players[match.player2] || 'TBD';

    const btn1 = document.createElement('button');
    btn1.className = 'btn-win-p1';
    btn1.textContent = `${p1Name} Wins`;
    btn1.addEventListener('click', () => {
      if (callbacks && callbacks.onResult) {
        callbacks.onResult(card, match.matchIndex, match.player1, p1Name);
      }
    });

    const btn2 = document.createElement('button');
    btn2.className = 'btn-win-p2';
    btn2.textContent = `${p2Name} Wins`;
    btn2.addEventListener('click', () => {
      if (callbacks && callbacks.onResult) {
        callbacks.onResult(card, match.matchIndex, match.player2, p2Name);
      }
    });

    actions.appendChild(btn1);
    actions.appendChild(btn2);
    card.appendChild(actions);
  } else if (isReady && !isBye && !isDirector) {
    const status = document.createElement('div');
    status.className = 'match-status';
    status.innerHTML = '&#9203; In Progress';
    card.appendChild(status);
  } else if (isBye && hasWinner) {
    const status = document.createElement('div');
    status.className = 'match-status';
    status.textContent = 'Bye';
    card.appendChild(status);
  }

  return card;
}

function createPlayerRow(playerIdx, match, players, hasWinner, slot) {
  const row = document.createElement('div');
  row.className = 'match-player-row';

  if (playerIdx === null || playerIdx === undefined) {
    row.classList.add('is-tbd');
    const name = document.createElement('span');
    name.className = 'player-name';
    name.textContent = 'TBD';
    row.appendChild(name);
    return row;
  }

  if (hasWinner) {
    if (match.winner === playerIdx) {
      row.classList.add('is-winner');
    } else {
      row.classList.add('is-loser');
    }
  }

  // Seed number
  const seed = document.createElement('span');
  seed.className = 'player-seed';
  seed.textContent = playerIdx + 1;
  row.appendChild(seed);

  // Player name
  const name = document.createElement('span');
  name.className = 'player-name';
  name.textContent = players[playerIdx] || 'Unknown';
  row.appendChild(name);

  return row;
}


// =====================================================
// DRAW CONNECTOR LINES (CSS-based via dynamic styles)
// =====================================================
function drawConnectors(treeEl, totalRounds) {
  const cols = treeEl.querySelectorAll('.bracket-round-col');

  for (let r = 0; r < cols.length - 1; r++) {
    const currentWraps = cols[r].querySelectorAll('.bracket-match-wrap');
    const nextWraps = cols[r + 1].querySelectorAll('.bracket-match-wrap');

    for (let i = 0; i < currentWraps.length; i += 2) {
      const top = currentWraps[i];
      const bottom = currentWraps[i + 1];
      const target = nextWraps[Math.floor(i / 2)];

      if (!top || !target) continue;

      const topRect = top.getBoundingClientRect();
      const treeRect = treeEl.getBoundingClientRect();

      // Get midpoints relative to the tree
      const topMid = topRect.top + topRect.height / 2 - treeRect.top;
      let bottomMid;

      if (bottom) {
        const bottomRect = bottom.getBoundingClientRect();
        bottomMid = bottomRect.top + bottomRect.height / 2 - treeRect.top;
      } else {
        bottomMid = topMid;
      }

      // Create vertical connector between the pair
      if (bottom) {
        const connector = document.createElement('div');
        connector.className = 'bracket-connector';
        connector.style.position = 'absolute';
        connector.style.left = (cols[r].offsetLeft + cols[r].offsetWidth) + 'px';
        connector.style.top = topMid + 'px';
        connector.style.height = (bottomMid - topMid) + 'px';
        connector.style.width = '2px';
        connector.style.background = 'rgba(255,255,255,0.1)';
        treeEl.style.position = 'relative';
        treeEl.appendChild(connector);
      }
    }
  }
}


// =====================================================
// RENDER ELIMINATION BOARDS (shows active boards)
// =====================================================
function renderEliminationBoards(container, data, players, isDirector, callbacks) {
  container.innerHTML = '';

  const format = data.config.format || 'elimination';
  let allMatches;
  if (format === 'double_elimination') {
    allMatches = [
      ...(Array.isArray(data.winners) ? data.winners : Object.values(data.winners || {})),
      ...(Array.isArray(data.losers) ? data.losers : Object.values(data.losers || {})),
      ...(Array.isArray(data.grandFinal) ? data.grandFinal : Object.values(data.grandFinal || {}))
    ];
  } else {
    allMatches = Array.isArray(data.bracket) ? data.bracket : Object.values(data.bracket || {});
  }

  const boardState = data.boardState || {};
  const numBoards = data.config.boards || 1;

  let bracketSize = 1;
  while (bracketSize < players.length) bracketSize *= 2;
  const totalRounds = Math.log2(bracketSize);

  const grid = document.createElement('div');
  grid.className = 'elim-boards-grid';

  for (let b = 0; b < numBoards; b++) {
    const bs = boardState[b];
    const card = document.createElement('div');
    card.className = 'elim-board-card';
    card.style.position = 'relative';

    if (bs && bs.matchIndex !== undefined && bs.matchIndex !== null) {
      const match = allMatches.find(m => m.matchIndex === bs.matchIndex);
      if (!match || match.player1 === null || match.player2 === null) {
        card.innerHTML = `
          <div class="elim-board-header"><span class="board-num">Board ${b + 1}</span><span class="board-round-tag">Waiting</span></div>
          <div class="elim-board-idle">Waiting for players...</div>`;
        grid.appendChild(card);
        continue;
      }

      card.classList.add('board-active');
      const p1Name = players[match.player1] || 'TBD';
      const p2Name = players[match.player2] || 'TBD';
      let roundName;
      if (match.bracket === 'winners') {
        roundName = 'WB ' + getEliminationRoundName(match.round, totalRounds);
      } else if (match.bracket === 'losers') {
        roundName = 'LB R' + (match.round + 1);
      } else if (match.bracket === 'grand_final') {
        roundName = match.label || 'Grand Final';
      } else {
        roundName = getEliminationRoundName(match.round, totalRounds);
      }

      card.innerHTML = `
        <div class="elim-board-header">
          <span class="board-num">Board ${b + 1}</span>
          <span class="board-round-tag">${roundName}</span>
        </div>
        <div class="elim-board-body">
          <div class="elim-board-matchup">
            <div class="elim-board-player white-player">&#9812; ${escHtml(p1Name)}</div>
            <div class="elim-board-vs">vs</div>
            <div class="elim-board-player black-player">&#9818; ${escHtml(p2Name)}</div>
          </div>
          ${isDirector ? `
          <div class="elim-board-actions">
            <button class="btn-success" data-board="${b}" data-match="${match.matchIndex}" data-winner="${match.player1}" data-name="${escHtml(p1Name)}">&#9812; ${escHtml(p1Name)} Wins</button>
            <button class="btn-danger" data-board="${b}" data-match="${match.matchIndex}" data-winner="${match.player2}" data-name="${escHtml(p2Name)}">&#9818; ${escHtml(p2Name)} Wins</button>
          </div>` : `<div class="text-center text-dim" style="font-style:italic;padding:10px 0;">&#9203; In Progress</div>`}
        </div>`;
    } else {
      card.innerHTML = `
        <div class="elim-board-header"><span class="board-num">Board ${b + 1}</span><span class="board-round-tag">Idle</span></div>
        <div class="elim-board-idle">No active game</div>`;
    }
    grid.appendChild(card);
  }

  container.appendChild(grid);

  // Attach result handlers
  grid.querySelectorAll('.elim-board-actions button').forEach(btn => {
    btn.addEventListener('click', () => {
      const matchIdx = parseInt(btn.dataset.match);
      const winner = parseInt(btn.dataset.winner);
      const winnerName = btn.dataset.name;
      const boardIdx = parseInt(btn.dataset.board);
      if (callbacks && callbacks.onResult) {
        callbacks.onResult(btn.closest('.elim-board-card'), matchIdx, winner, winnerName);
      }
    });
  });
}

function escHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


// =====================================================
// EXPORT FOR USE IN MAIN index.html
// =====================================================
export {
  generateBracket,
  advanceBracketByes,
  generateDoubleEliminationBracket,
  getEliminationRoundName,
  getLBRoundName,
  getReadyMatches,
  assignMatchesToBoards,
  initializeBoardState,
  renderSingleEliminationBracket,
  renderDoubleEliminationBracket,
  renderEliminationBoards,
  createMatchCard,
  escHtml
};
