/* ============================================================
   EduTest AI – Game Console engine
   ============================================================ */

const LEVEL_ICONS = {
  'Beginner': '🥉',
  'SEO Learner': '📘',
  'Optimizer': '⚙️',
  'SEO Expert': '🚀',
  'SEO Master': '👑',
};

const CATEGORY_ICONS = {
  'Meta': '🏷️',
  'Structure': '🏗️',
  'Quality': '⭐',
  'Links': '🔗',
  'Server': '🖥️',
  'External': '🌐',
};

const MODE_LABELS = {
  meta_desc: '✍️ Rewrite',
  title: '✍️ Rewrite',
  url_slug: '🔗 URL rewrite',
  quiz: '🧠 Recall',
};

const GAME = {
  recordId: null,
  url: '',
  tasks: [],
  totalXp: 0,
  maxXp: 0,
  completedCount: 0,
  totalCount: 0,
  level: { name: 'Beginner', color: '#9e9e9e', progress: 0, next_at: 100 },
  badgesCatalog: [],
  earnedBadgeIds: [],
  completedIndexes: new Set(),
};

function getCsrfToken() {
  const input = document.querySelector('input[name=csrfmiddlewaretoken]');
  return input ? input.value : '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', () => {
  const dataEl = document.getElementById('game-data');
  if (!dataEl) return; // empty state page — nothing to wire up

  const payload = JSON.parse(dataEl.textContent);
  GAME.recordId = payload.record_id;
  GAME.readOnly = !!payload.read_only;
  GAME.url = payload.url;
  GAME.tasks = payload.tasks || [];
  GAME.totalXp = payload.total_xp || 0;
  GAME.maxXp = payload.max_xp || 0;
  GAME.completedCount = payload.completed_count || 0;
  GAME.totalCount = payload.total_count || GAME.tasks.length;
  GAME.level = payload.level;
  GAME.badgesCatalog = payload.badges || [];
  GAME.earnedBadgeIds = payload.earned_badge_ids || [];
  GAME.completedIndexes = new Set(payload.completed_indexes || []);

  document.getElementById('hudUrl').textContent = GAME.url;
  document.getElementById('resetConsoleBtn')?.addEventListener('click', resetConsole);

  renderPlayerCard();
  renderBadgeVault();
  renderMissionLog();
});

// -----------------------------------------------------------------------
// Rendering
// -----------------------------------------------------------------------
function renderPlayerCard() {
  const icon = LEVEL_ICONS[GAME.level.name] || '🎮';
  document.getElementById('levelRingIcon').textContent = icon;
  document.getElementById('playerLevelName').textContent = GAME.level.name;
  document.getElementById('playerLevelName').style.color = GAME.level.color;
  document.getElementById('playerLevelSub').textContent =
    `${GAME.completedCount}/${GAME.totalCount} missions cleared`;

  const ringFill = document.getElementById('levelRingFill');
  ringFill.style.setProperty('--lvl-color', GAME.level.color);
  ringFill.style.setProperty('--lvl-progress', GAME.level.progress || 0);

  document.getElementById('xpBarFill').style.width = `${Math.round((GAME.level.progress || 0) * 100)}%`;
  document.getElementById('xpBarCurrent').textContent = `${GAME.totalXp} XP`;
  document.getElementById('xpBarNext').textContent =
    GAME.level.next_at ? `Next level at ${GAME.level.next_at} XP` : 'Max level reached';

  const mpProgress = GAME.totalCount > 0 ? GAME.completedCount / GAME.totalCount : 0;
  document.getElementById('mpRingFill').style.setProperty('--mp-progress', mpProgress);
  document.getElementById('mpRingLabel').textContent = `${GAME.completedCount}/${GAME.totalCount}`;
}

function renderBadgeVault() {
  const vault = document.getElementById('badgeVault');
  vault.innerHTML = '';
  GAME.badgesCatalog.forEach((badge) => {
    const earned = GAME.earnedBadgeIds.includes(badge.id);
    const card = document.createElement('div');
    card.className = `badge-card ${earned ? 'earned' : ''}`;
    card.id = `badge-${badge.id}`;
    card.innerHTML = `
      <div class="badge-card-inner">
        <div class="badge-face front">
          <div class="badge-icon-big">${badge.icon}</div>
          <div class="badge-name">${escapeHtml(badge.name)}</div>
          <div class="badge-status">${earned ? 'Unlocked' : 'Locked'}</div>
        </div>
        <div class="badge-face back">
          <p>${escapeHtml(badge.desc)}</p>
        </div>
      </div>`;
    vault.appendChild(card);
  });
}

function renderMissionLog() {
  const log = document.getElementById('missionLog');
  log.innerHTML = '';

  if (GAME.tasks.length === 0) {
    log.innerHTML = `<div class="mission-card"><div class="mission-body-inner" style="padding-top:18px">
      🎉 No issues were detected — nothing to fix on this page!</div></div>`;
    return;
  }

  GAME.tasks.forEach((task) => log.appendChild(buildMissionCard(task)));
}

function buildMissionCard(task) {
  const idx = task.task_index;
  const isDone = GAME.completedIndexes.has(idx);
  const diffClass = isDone ? 'done' : `difficulty-${task.imp}`;
  const catIcon = CATEGORY_ICONS[task.cat] || '📄';
  const stars = '★'.repeat(task.imp) + '☆'.repeat(3 - task.imp);

  const card = document.createElement('div');
  card.className = `mission-card ${diffClass}`;
  card.id = `mission-${idx}`;

  card.innerHTML = `
    <div class="mission-stamp">CLEARED</div>
    <div class="mission-header" data-idx="${idx}">
      <div class="mission-header-left">
        <div class="mission-category-chip">${catIcon}</div>
        <div class="mission-title-block">
          <div class="mission-title">${escapeHtml(task.check)}</div>
          <div class="mission-meta">
            <span class="mission-stars">${stars}</span>
            <span class="mission-mode-tag">${MODE_LABELS[task.task_type] || 'Task'}</span>
          </div>
        </div>
      </div>
      <span class="mission-xp-chip">${isDone ? 'Cleared ✓' : `+${task.xp} XP`}</span>
    </div>
    <div class="mission-body">
      <div class="mission-body-inner">
        <div class="mission-detail">${escapeHtml(task.detail)}</div>
        <div class="mission-fix">🔧 Objective → ${escapeHtml(task.fix)}</div>
        <div class="mission-interaction"></div>
        <div class="mission-feedback" id="mission-feedback-${idx}"></div>
      </div>
    </div>`;

  card.querySelector('.mission-header').addEventListener('click', () => {
    card.classList.toggle('open');
  });

  const interaction = card.querySelector('.mission-interaction');
  if (isDone) {
    renderDoneState(interaction, task);
  } else {
    renderInteraction(interaction, task);
  }

  return card;
}

function renderDoneState(container, task) {
  if (GAME.readOnly) {
    container.innerHTML = `
      <div class="mission-done-msg">
        <span>✅ Verified — +${task.xp} XP collected.</span>
      </div>`;
    return;
  }
  container.innerHTML = `
    <div class="mission-done-msg">
      <span>✅ Verified — +${task.xp} XP already collected.</span>
      <button class="btn btn-glass" data-undo="${task.task_index}" style="padding:4px 12px;font-size:12px">
        ↺ Redo
      </button>
    </div>`;
  container.querySelector('[data-undo]').addEventListener('click', (e) => {
    e.stopPropagation();
    undoMission(task.task_index);
  });
}

function renderInteraction(container, task) {
  if (GAME.readOnly) {
    container.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);padding:8px 0">
        <i class="fa-solid fa-lock"></i> Not yet completed — read-only view.
      </div>`;
    return;
  }
  if (task.task_type === 'meta_desc') {
    container.innerHTML = `
      <textarea class="mission-input" placeholder="A 120–160 character summary containing your primary keyword..."></textarea>
      <button class="btn btn-primary" data-validate>✅ Deploy fix</button>`;
    wireValidate(container, task, () => ({ value: container.querySelector('textarea').value }));
  } else if (task.task_type === 'title') {
    container.innerHTML = `
      <input type="text" class="mission-input" placeholder="A concise, keyword-rich title, 30–60 characters..." />
      <button class="btn btn-primary" data-validate>✅ Deploy fix</button>`;
    wireValidate(container, task, () => ({ value: container.querySelector('input').value }));
  } else if (task.task_type === 'url_slug') {
    container.innerHTML = `
      <input type="text" class="mission-input" placeholder="/keyword-rich-slug" />
      <button class="btn btn-primary" data-validate>✅ Deploy fix</button>`;
    wireValidate(container, task, () => ({ value: container.querySelector('input').value }));
  } else {
    const quiz = task.quiz || { question: 'Quick check', options: [] };
    let selected = null;
    const optionsHtml = quiz.options.map((opt, i) =>
      `<div class="mission-quiz-option" data-opt="${i}">${escapeHtml(opt)}</div>`).join('');
    container.innerHTML = `
      <div style="font-size:13px;font-weight:600;margin-bottom:10px">🧠 ${escapeHtml(quiz.question)}</div>
      <div class="mission-quiz-options">${optionsHtml}</div>
      <button class="btn btn-primary" data-validate>✅ Submit & deploy</button>`;

    container.querySelectorAll('.mission-quiz-option').forEach((el) => {
      el.addEventListener('click', () => {
        container.querySelectorAll('.mission-quiz-option').forEach((o) => o.classList.remove('selected'));
        el.classList.add('selected');
        selected = parseInt(el.getAttribute('data-opt'), 10);
      });
    });

    wireValidate(container, task, () => ({ choice_index: selected }));
  }
}

function wireValidate(container, task, getPayload) {
  container.querySelector('[data-validate]').addEventListener('click', async (e) => {
    e.stopPropagation();
    const payload = getPayload();
    if (task.task_type === 'quiz' && (payload.choice_index === null || payload.choice_index === undefined)) {
      showConsoleToast('Select an answer first', false);
      return;
    }
    await validateMission(task.task_index, payload);
  });
}

// -----------------------------------------------------------------------
// Server calls
// -----------------------------------------------------------------------
async function validateMission(taskIndex, payload) {
  const feedbackEl = document.getElementById(`mission-feedback-${taskIndex}`);
  try {
    const res = await fetch(`/analysis/game/${GAME.recordId}/validate/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      body: JSON.stringify({ task_index: taskIndex, ...payload }),
    });
    const data = await res.json();

    if (!data.ok) {
      showConsoleToast(data.error || 'Something went wrong', false);
      return;
    }
    if (!data.correct) {
      feedbackEl.textContent = `❌ ${data.message}`;
      feedbackEl.className = 'mission-feedback show incorrect';
      return;
    }

    feedbackEl.className = 'mission-feedback';
    const previousLevelName = GAME.level.name;

    GAME.completedIndexes.add(taskIndex);
    GAME.totalXp = data.total_xp;
    GAME.completedCount = data.completed_count;
    GAME.totalCount = data.total_count;
    GAME.level = data.level;
    GAME.earnedBadgeIds = data.earned_badge_ids;

    renderPlayerCard();
    renderBadgeVault();
    rebuildSingleMission(taskIndex);
    fireConfetti(26);
    showConsoleToast(`+${data.xp_awarded} XP — mission cleared!`, true);

    if (data.level.name !== previousLevelName) {
      setTimeout(() => showLevelUp(data.level), 500);
    }

    (data.newly_earned_badges || []).forEach((badge, i) => {
      setTimeout(() => showBadgeUnlock(badge), 900 + i * 1400);
    });

    if (GAME.completedCount === GAME.totalCount && GAME.totalCount > 0) {
      setTimeout(() => {
        document.getElementById('victoryOverlay').classList.add('show');
        fireConfetti(90);
      }, 1200);
    }
  } catch (err) {
    showConsoleToast('Network error validating this mission', false);
  }
}

async function undoMission(taskIndex) {
  try {
    const res = await fetch(`/analysis/game/${GAME.recordId}/undo/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      body: JSON.stringify({ task_index: taskIndex }),
    });
    const data = await res.json();
    if (!data.ok) {
      showConsoleToast(data.error || 'Could not undo this mission', false);
      return;
    }
    GAME.completedIndexes.delete(taskIndex);
    GAME.totalXp = data.total_xp;
    GAME.completedCount = data.completed_count;
    GAME.totalCount = data.total_count;
    GAME.level = data.level;
    GAME.earnedBadgeIds = data.earned_badge_ids;

    document.getElementById('victoryOverlay').classList.remove('show');
    renderPlayerCard();
    renderBadgeVault();
    rebuildSingleMission(taskIndex);
  } catch (err) {
    showConsoleToast('Network error undoing this mission', false);
  }
}

async function resetConsole() {
  if (!window.confirm('Reset all mission progress for this audit? This cannot be undone.')) return;
  try {
    const res = await fetch(`/analysis/game/${GAME.recordId}/reset/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!data.ok) {
      showConsoleToast(data.error || 'Could not reset progress', false);
      return;
    }
    GAME.completedIndexes = new Set();
    GAME.totalXp = data.total_xp;
    GAME.completedCount = data.completed_count;
    GAME.totalCount = data.total_count;
    GAME.level = data.level;
    GAME.earnedBadgeIds = data.earned_badge_ids;

    document.getElementById('victoryOverlay').classList.remove('show');
    renderPlayerCard();
    renderBadgeVault();
    renderMissionLog();
    showConsoleToast('Progress reset', true);
  } catch (err) {
    showConsoleToast('Network error resetting progress', false);
  }
}

function rebuildSingleMission(taskIndex) {
  const task = GAME.tasks.find((t) => t.task_index === taskIndex);
  if (!task) return;
  const oldCard = document.getElementById(`mission-${taskIndex}`);
  const newCard = buildMissionCard(task);
  if (GAME.completedIndexes.has(taskIndex)) newCard.classList.add('open');
  oldCard.replaceWith(newCard);
}

// -----------------------------------------------------------------------
// Overlays + confetti + lightweight toast (this page has no showToast())
// -----------------------------------------------------------------------
function showLevelUp(level) {
  document.getElementById('levelUpIcon').textContent = LEVEL_ICONS[level.name] || '🚀';
  document.getElementById('levelUpText').textContent = `You've reached ${level.name}!`;
  document.getElementById('levelUpOverlay').classList.add('show');
  fireConfetti(60);
}

function showBadgeUnlock(badge) {
  document.getElementById('badgeOverlayIcon').textContent = badge.icon;
  document.getElementById('badgeOverlayText').textContent = `${badge.name} — ${badge.desc}`;
  document.getElementById('badgeOverlay').classList.add('show');
  fireConfetti(50);
}

function fireConfetti(count = 30) {
  const colors = ['#5b8def', '#00e0a1', '#a78bfa', '#ffaa3b', '#ff5c6c', '#38bdf8'];
  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = `${1.2 + Math.random() * 1.2}s`;
    piece.style.opacity = String(0.7 + Math.random() * 0.3);
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 2600);
  }
}

let toastTimer = null;
function showConsoleToast(message, ok) {
  let el = document.getElementById('consoleToast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'consoleToast';
    el.style.cssText = `
      position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
      padding:12px 22px;border-radius:12px;font-size:13px;font-weight:600;
      z-index:10000;box-shadow:0 8px 24px rgba(0,0,0,0.4);transition:opacity .3s;`;
    document.body.appendChild(el);
  }
  el.style.background = ok ? '#00e0a1' : '#ff5c6c';
  el.style.color = '#060b18';
  el.textContent = message;
  el.style.opacity = '1';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}
