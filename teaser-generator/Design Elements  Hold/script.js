const gridElement = document.querySelector('[data-crossword-grid]');

if (gridElement) {
  const gridSize = 9;
  const blackSquares = new Set([
    '0-0', '0-1', '0-7', '0-8',
    '1-0', '1-8',
    '2-0', '2-3', '2-4', '2-5', '2-8',
    '3-0', '3-2', '3-6', '3-8',
    '4-0', '4-8',
    '5-0', '5-2', '5-6', '5-8',
    '6-0', '6-3', '6-4', '6-8',
    '7-0', '7-8',
    '8-0', '8-1', '8-7', '8-8'
  ]);

  const letterPlacements = new Map([
    ['1-2', 'T'],
    ['1-3', 'O'],
    ['1-4', 'D'],
    ['1-5', 'E'],
    ['3-5', 'M'],
    ['4-5', 'E'],
    ['5-5', 'E'],
    ['6-5', 'T'],
    ['4-2', 'R'],
    ['4-3', 'I'],
    ['4-4', 'S']
  ]);

  for (let row = 0; row < gridSize; row += 1) {
    for (let col = 0; col < gridSize; col += 1) {
      const key = `${row}-${col}`;
      const cell = document.createElement('div');
      cell.classList.add('cell');

      if (blackSquares.has(key)) {
        cell.classList.add('black');
      } else {
        cell.classList.add('white');
        const letter = letterPlacements.get(key);

        if (letter) {
          cell.textContent = letter;
          cell.classList.add('letter', 'raised');
        }
      }

      gridElement.appendChild(cell);
    }
  }
}

(function () {
  const noteStack = document.getElementById('noteStack');
  const overlay = document.getElementById('hintOverlay');

  if (!noteStack || !overlay) {
    return;
  }

  const closeButton = overlay.querySelector('.hint-close');
  const noteContainers = noteStack.querySelectorAll('.note-container');
  const hintCountBadge = document.querySelector('.badge.muted[aria-live]');
  let lastFocus = null;

  if (hintCountBadge) {
    const bullet = String.fromCharCode(8226);
    hintCountBadge.textContent = `${noteContainers.length} ${bullet}`;
  }

  const showHintOverlay = (event) => {
    lastFocus = event?.currentTarget ?? document.activeElement;
    noteStack.classList.add('is-hidden');
    overlay.classList.add('is-visible');
    overlay.setAttribute('aria-hidden', 'false');
    closeButton?.focus();
  };

  const hideHintOverlay = () => {
    overlay.classList.remove('is-visible');
    overlay.setAttribute('aria-hidden', 'true');
    noteStack.classList.remove('is-hidden');
    if (lastFocus instanceof HTMLElement) {
      lastFocus.focus();
    }
  };

  noteContainers.forEach((container) => {
    container.addEventListener('click', showHintOverlay);
    container.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        showHintOverlay(event);
      }
    });
  });

  closeButton?.addEventListener('click', hideHintOverlay);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      hideHintOverlay();
    }
  });

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('is-visible')) {
      hideHintOverlay();
    }
  });
})();
