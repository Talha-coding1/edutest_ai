/* ============================================
   NeuralChat AI – Profile Page JS
   ============================================ */

window.addEventListener('DOMContentLoaded', () => {
  initProfilePage();
  initInterests();
  generateActivityHeatmap();
  handlePreferences();
});

function getCsrfToken() {
  const input = document.querySelector('input[name=csrfmiddlewaretoken]');
  return input ? input.value : '';
}

function initProfilePage() {
  // Edit profile button — reveal the real inline edit form
  const editBtn = document.getElementById('editProfileBtn');
  const viewBlock = document.getElementById('personalInfoView');
  const formBlock = document.getElementById('personalInfoForm');

  editBtn?.addEventListener('click', () => {
    viewBlock.style.display = 'none';
    formBlock.style.display = 'block';
    // Smooth scroll to the personal info section
    const target = document.getElementById('personalInfo');
    if (target) {
      setTimeout(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 60);
    }
  });

  document.getElementById('cancelEditBtn')?.addEventListener('click', () => {
    formBlock.style.display = 'none';
    viewBlock.style.display = 'block';
  });

  // Edit avatar button — not implemented yet, said honestly
  document.getElementById('editAvatarBtn')?.addEventListener('click', () => {
    showToast('Avatar upload is not available yet', 'info');
  });
}

// -----------------------------------------------------------------------
// Interests — real, persisted per-user tags (add + remove), no fake presets
// -----------------------------------------------------------------------
function getCurrentInterests() {
  return Array.from(document.querySelectorAll('#interestTags .interest-tag[data-interest]'))
    .map((el) => el.getAttribute('data-interest'));
}

function renderInterestTags(interests) {
  const container = document.getElementById('interestTags');
  if (!container) return;

  container.innerHTML = interests.length
    ? interests.map((name) => `
        <span class="interest-tag" data-interest="${escapeHtmlAttr(name)}">
          ${escapeHtmlAttr(name)}
          <button class="remove-interest" data-interest="${escapeHtmlAttr(name)}" aria-label="Remove ${escapeHtmlAttr(name)}">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </span>`).join('')
    : `<span style="font-size:12px;color:var(--text-muted)">No interests added yet.</span>`;

  wireInterestButtons();
}

function escapeHtmlAttr(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function wireInterestButtons() {
  document.querySelectorAll('.remove-interest').forEach((btn) => {
    btn.addEventListener('click', () => {
      const toRemove = btn.getAttribute('data-interest');
      const updated = getCurrentInterests().filter((i) => i !== toRemove);
      savePreference({ interests: updated }).then((data) => {
        if (data) renderInterestTags(data.interests);
      });
    });
  });
}

function initInterests() {
  wireInterestButtons();
  wireInterestDropdown();
}

function wireInterestDropdown() {
  const select = document.getElementById('interestTopicSelect');
  if (!select) return;

  select.addEventListener('change', () => {
    const value = select.value;
    select.value = ''; // reset back to placeholder immediately
    if (!value) return;

    const current = getCurrentInterests();
    if (current.some((i) => i.toLowerCase() === value.toLowerCase())) {
      showToast('That topic is already on your list', 'info');
      return;
    }

    const updated = [...current, value];
    savePreference({ interests: updated }).then((data) => {
      if (data) {
        renderInterestTags(data.interests);
        showToast(`Added "${value}" — matching quizzes will now show on your Quiz page`, 'success', 3500);
      }
    });
  });
}

function generateActivityHeatmap() {
  const heatmapGrid = document.getElementById('heatmapGrid');
  if (!heatmapGrid) return;

  heatmapGrid.innerHTML = ''; // Clear existing

  // Real audit dates for this user, e.g. ["2026-07-20", "2026-07-25", ...]
  let auditDates = [];
  const dataEl = document.getElementById('audit-dates-data');
  if (dataEl) {
    try {
      auditDates = JSON.parse(dataEl.textContent) || [];
    } catch (e) {
      auditDates = [];
    }
  }

  // Bucket audits into ISO week keys (e.g. "2026-30") so the heatmap
  // reflects real weeks in which this user actually ran an analysis.
  const weekCounts = {};
  auditDates.forEach((iso) => {
    const d = new Date(iso + 'T00:00:00');
    const weekKey = isoWeekKey(d);
    weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;
  });

  const colors = [
    'transparent',
    'rgba(108, 99, 255, 0.3)',
    'rgba(108, 99, 255, 0.5)',
    'rgba(108, 99, 255, 0.7)',
    '#6c63ff',
  ];

  // Generate the last 52 weeks, oldest to newest
  const today = new Date();
  for (let i = 0; i < 52; i++) {
    const cell = document.createElement('div');
    cell.className = 'heatmap-cell';

    const weekDate = new Date(today);
    weekDate.setDate(weekDate.getDate() - (51 - i) * 7);
    const weekKey = isoWeekKey(weekDate);
    const count = weekCounts[weekKey] || 0;
    const level = Math.min(count, 4);

    cell.style.background = colors[level];
    cell.title = count === 0
      ? `No analyses in the week of ${weekDate.toLocaleDateString()}`
      : `${count} analysis${count === 1 ? '' : 'es'} in the week of ${weekDate.toLocaleDateString()}`;

    heatmapGrid.appendChild(cell);
  }
}

function isoWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-${weekNo}`;
}

async function savePreference(payload) {
  const statusEl = document.getElementById('prefSaveStatus');
  try {
    const res = await fetch('/profile/preferences/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) {
      showToast(data.error || 'Could not save preference', 'error');
      return null;
    }
    if (statusEl) {
      statusEl.textContent = '✓ Saved';
      setTimeout(() => { statusEl.textContent = ''; }, 1800);
    }
    return data;
  } catch (err) {
    showToast('Network error saving preference', 'error');
    return null;
  }
}

function updateGoalStatusUI(goalStatus) {
  if (!goalStatus) return;
  const slider = document.getElementById('dailyGoal');
  const note = document.getElementById('goalStatusNote');
  if (slider) slider.disabled = !!goalStatus.is_locked;
  if (!note) return;

  if (goalStatus.is_locked) {
    note.style.color = 'var(--accent-warning)';
    note.innerHTML = `<i class="fa-solid fa-lock"></i> Locked — ${goalStatus.minutes_completed_today}/${goalStatus.goal_minutes} min completed today. ` +
      `Finish ${goalStatus.remaining_minutes} more minute${goalStatus.remaining_minutes === 1 ? '' : 's'} of quizzes to unlock.`;
  } else {
    note.style.color = 'var(--accent-secondary)';
    note.innerHTML = goalStatus.minutes_completed_today > 0
      ? `<i class="fa-solid fa-lock-open"></i> Goal reached today (${goalStatus.minutes_completed_today}/${goalStatus.goal_minutes} min) — you can set a new goal.`
      : `<i class="fa-solid fa-lock-open"></i> Pick a goal to lock it in for today — it unlocks automatically once you complete that many quiz minutes.`;
  }
}

function handlePreferences() {
  // Daily goal slider — live label while dragging, save once released
  const dailyGoalSlider = document.getElementById('dailyGoal');
  const goalValue = document.getElementById('goalValue');

  dailyGoalSlider?.addEventListener('input', () => {
    goalValue.textContent = dailyGoalSlider.value;
  });
  dailyGoalSlider?.addEventListener('change', () => {
    savePreference({ daily_goal_minutes: parseInt(dailyGoalSlider.value, 10) }).then((data) => {
      if (data) updateGoalStatusUI(data.goal_status);
    });
  });

  // Toggle switches (decorative — no backend for notifications yet)
  document.querySelectorAll('.toggle-switch input').forEach((toggle) => {
    toggle.addEventListener('change', () => {
      const label = toggle.nextElementSibling.nextElementSibling.textContent;
      showToast(`${label} ${toggle.checked ? 'enabled' : 'disabled'}`, 'success');
    });
  });

  // Learning Style — single-select within its group, persisted
  wireSingleSelectGroup('learningStyleTags', (value) => savePreference({ learning_style: value }));

  // Difficulty Level — MULTI-select: any combination of Beginner/Intermediate/
  // Advanced can be active at once. Each click toggles just that tag, then
  // the full set of currently-active values is sent and persisted.
  wireMultiSelectGroup('difficultyTags', (values) => {
    savePreference({ difficulty_levels: values }).then((data) => {
      if (data) {
        const label = data.difficulty_labels.length
          ? data.difficulty_labels.join(', ')
          : 'no levels (showing all quizzes)';
        showToast(`Quiz levels set to: ${label}`, 'success', 3500);
      }
    });
  });
}

function wireSingleSelectGroup(containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.pref-tag').forEach((tag) => {
    tag.addEventListener('click', () => {
      container.querySelectorAll('.pref-tag').forEach((t) => t.classList.remove('active'));
      tag.classList.add('active');
      onSelect(tag.getAttribute('data-value'));
    });
  });
}

function wireMultiSelectGroup(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.pref-tag').forEach((tag) => {
    tag.addEventListener('click', () => {
      tag.classList.toggle('active');
      const selected = Array.from(container.querySelectorAll('.pref-tag.active'))
        .map((t) => t.getAttribute('data-value'));
      onChange(selected);
    });
  });
}

// Animate numbers on load
window.addEventListener('load', () => {
  document.querySelectorAll('.stat-num').forEach(stat => {
    const target = parseInt(stat.textContent);
    let current = 0;
    const increment = target / 30;
    const interval = setInterval(() => {
      current += increment;
      if (current >= target) {
        stat.textContent = target.toLocaleString();
        clearInterval(interval);
      } else {
        stat.textContent = Math.floor(current).toLocaleString();
      }
    }, 30);
  });
});
