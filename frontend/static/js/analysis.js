/* ============================================
   EduTest AI – Analysis Page JS
   ============================================ */

window.addEventListener('DOMContentLoaded', () => {
  initAnalysisCharts();
  handleChartTabs();
  handleExport();
  handleUrlSubmit();
});

// -----------------------------------------------------------------------
// NEW: wire the "Submit URL" button to the real SEO audit endpoint
// -----------------------------------------------------------------------
function getCsrfToken() {
  const input = document.querySelector('input[name=csrfmiddlewaretoken]');
  return input ? input.value : '';
}

function handleUrlSubmit() {
  const btn = document.getElementById('submitUrlBtn');
  const btnText = document.getElementById('submitUrlBtnText');
  const input = document.getElementById('urlInput');
  const statusEl = document.getElementById('analysisStatus');
  if (!btn || !input) return;

  const runAudit = async () => {
    const url = input.value.trim();
    if (!url) {
      showToast('Enter a URL first', 'error');
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Analyzing...';
    statusEl.style.display = 'block';
    statusEl.textContent = `Crawling ${url} and running the model...`;

    try {
      const res = await fetch('/analysis/run/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': getCsrfToken(),
        },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();

      if (!data.ok) {
        statusEl.textContent = `Could not analyze this URL: ${data.error}`;
        showToast(data.error || 'Analysis failed', 'error');
        return;
      }

      statusEl.style.display = 'none';
      renderAuditResults(data);
      showToast('Analysis complete!', 'success');
    } catch (err) {
      statusEl.textContent = 'Network error while contacting the analyzer.';
      showToast('Network error', 'error');
    } finally {
      btn.disabled = false;
      btnText.textContent = 'Submit URL';
    }
  };

  btn.addEventListener('click', runAudit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') runAudit();
  });
}

// Update the 4 summary rings, the 6 skill bars, and the live-findings grid
// from a real run_full_audit() response.
function renderAuditResults(data) {
  window.lastAuditResult = data; // used by Export Report

  const cats = data.categories || {};
  const ringMap = {
    summaryAccuracy: { value: cats['Server'] ?? 0, label: 'Performance Score' },
    summarySpeed: { value: data.overall ?? 0, label: `SEO Score (ML: ${data.ml_score}%)` },
    summaryConsistency: { value: cats['Page quality'] ?? 0, label: 'Accessibility Health' },
    summaryEngagement: {
      value: Math.round(
        ((cats['Meta information'] ?? 0) + (cats['Page structure'] ?? 0) +
         (cats['Links'] ?? 0) + (cats['External factors'] ?? 0)) / 4
      ),
      label: 'Best Practices',
    },
  };

  Object.entries(ringMap).forEach(([id, { value, label }]) => {
    const card = document.getElementById(id);
    if (!card) return;
    const fill = card.querySelector('.ring-fill');
    const valEl = card.querySelector('.ring-value');
    const labelEl = card.querySelector('.summary-label');
    fill.style.setProperty('--progress', 0);
    setTimeout(() => fill.style.setProperty('--progress', value), 50);
    valEl.textContent = `${value}%`;
    if (labelEl) labelEl.textContent = label;
  });

  // Skill bars: replace the 6 hardcoded rows with real category scores
  const rows = document.querySelectorAll('.skills-list .skill-row');
  const catEntries = Object.entries(cats);
  rows.forEach((row, i) => {
    const entry = catEntries[i];
    if (!entry) return;
    const [name, pct] = entry;
    row.querySelector('.skill-name').textContent = name;
    row.querySelector('.skill-percent').textContent = `${pct}%`;
    const fillEl = row.querySelector('.skill-fill');
    fillEl.style.width = `${pct}%`;
  });

  // Live findings grid
  const section = document.getElementById('liveIssuesSection');
  const grid = document.getElementById('liveIssuesGrid');
  if (!grid) return;
  grid.innerHTML = '';

  if (!data.issues || data.issues.length === 0) {
    grid.innerHTML = `<div class="reco-card"><div class="reco-content">
      <h4>No issues found 🎉</h4><p>This page passed every automated check.</p>
      </div></div>`;
  } else {
    data.issues.forEach((issue) => {
      const color = issue.status === 'ERROR' ? '#ff6b6b' : '#ffa726';
      const icon = issue.status === 'ERROR' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation';
      const card = document.createElement('div');
      card.className = 'reco-card';
      card.innerHTML = `
        <div class="reco-icon" style="color:${color}"><i class="fa-solid ${icon}"></i></div>
        <div class="reco-content">
          <h4>${issue.check} <span style="font-size:11px;opacity:.6">(${issue.cat})</span></h4>
          <p>${issue.detail}</p>
          <p style="color:#5b8def;font-size:13px">🔧 ${issue.fix}</p>
        </div>`;
      grid.appendChild(card);
    });
  }
  section.style.display = 'block';

  // Reveal the Game Console CTA — the actual gamified console now lives on
  // its own page (opens in a new tab), backed by the persistent AuditRecord
  // this run just created server-side.
  const ctaSection = document.getElementById('consoleCtaSection');
  if (ctaSection) {
    const sub = document.getElementById('consoleCtaSub');
    if (sub) {
      const n = (data.issues || []).length;
      sub.textContent = `${n} issue${n === 1 ? '' : 's'} found on this page ` +
        `have been turned into live missions — earn XP, level up, and unlock badges by fixing them for real.`;
    }
    const openBtn = document.getElementById('openConsoleBtn');
    if (openBtn && data.console_url) {
      openBtn.href = data.console_url;
    }
    ctaSection.style.display = 'block';
  }
}

function initAnalysisCharts() {
  initProgressChart();
  initRadarChart();
}

function readJsonScript(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    return null;
  }
}

function initProgressChart() {
  const ctx = document.getElementById('progressChart');
  if (!ctx) return;

  const chartOptions = readJsonScript('score-trend-buckets-data');
  if (!chartOptions || !chartOptions.week) return;

  let initialRange = 'week';
  if (!chartOptions.week.labels.length) {
    initialRange = chartOptions.month.labels.length ? 'month' : 'year';
  }
  const initial = chartOptions[initialRange] || { labels: [], data: [] };

  if (initialRange !== 'week') {
    document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.chart-tab[data-range="${initialRange}"]`)?.classList.add('active');
  }

  let chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initial.labels,
      datasets: [{
        label: 'URL Test Score %',
        data: initial.data,
        borderColor: '#5b8def',
        backgroundColor: 'rgba(91, 141, 239, 0.07)',
        borderWidth: 3,
        pointBackgroundColor: '#5b8def',
        pointRadius: 5,
        pointHoverRadius: 7,
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#636b8a' },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
          ticks: { color: '#636b8a', callback: v => v + '%' },
        },
      },
    },
  });

  // Store reference to update on tab change
  window.progressChart = { instance: chart, options: chartOptions };
}

function initRadarChart() {
  const ctx = document.getElementById('radarChart');
  if (!ctx) return;

  const categoryAverages = readJsonScript('category-averages-data');
  if (!categoryAverages || Object.keys(categoryAverages).length === 0) return;

  window.radarChartInstance = new Chart(ctx, {
    type: 'radar',
    data: {
      labels: Object.keys(categoryAverages),
      datasets: [{
        label: 'Avg Score',
        data: Object.values(categoryAverages),
        borderColor: '#5b8def',
        backgroundColor: 'rgba(91, 141, 239, 0.12)',
        pointBackgroundColor: '#5b8def',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#5b8def',
      }],
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } },
      scales: {
        r: {
          min: 0,
          max: 100,
          ticks: { color: '#636b8a', backdropColor: 'transparent' },
          grid: { color: 'rgba(255, 255, 255, 0.04)' },
        },
      },
    },
  });
}

function handleChartTabs() {
  document.querySelectorAll('.chart-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.chart-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const range = tab.getAttribute('data-range');
      const options = window.progressChart?.options[range];
      
      if (options && window.progressChart?.instance) {
        window.progressChart.instance.data.labels = options.labels;
        window.progressChart.instance.data.datasets[0].data = options.data;
        window.progressChart.instance.update();
        showToast(`Showing ${range} view`, 'success');
      }
    });
  });
}

function handleExport() {
  document.getElementById('exportReportBtn')?.addEventListener('click', () => {
    const report = generateReport();
    const blob = new Blob([report], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'analysis-report.txt';
    a.click();
    showToast('Report exported!', 'success');
  });
}

function generateReport() {
  const date = new Date().toLocaleDateString();
  const d = window.lastAuditResult;

  if (!d) {
    return `EduTest AI - Website Analysis Report
Generated on: ${date}

No live analysis has been run yet. Submit a URL first, then export.`.trim();
  }

  const catLines = Object.entries(d.categories || {})
    .map(([k, v]) => `${k}: ${v}%`).join('\n');
  const issueLines = (d.issues || [])
    .map(i => `- [${i.status}] ${i.check} (${i.cat}): ${i.detail} -> Fix: ${i.fix}`)
    .join('\n');

  const report = `
EduTest AI - Website Analysis Report
Generated on: ${date}
URL: ${d.url}

SUMMARY
=======
Overall Score: ${d.overall}%
ML Model Score: ${d.ml_score}%
Grade: ${d.grade}
Errors: ${d.errors_count}  Warnings: ${d.warnings_count}

CATEGORY BREAKDOWN
==================
${catLines}

ISSUES FOUND
============
${issueLines || 'No issues found.'}

Keep iterating with evidence-based testing.
  `.trim();

  return report;
}

// Animate progress rings
function animateProgressRings() {
  document.querySelectorAll('.ring-fill').forEach(ring => {
    const progress = ring.style.getPropertyValue('--progress');
    if (progress) {
      ring.style.setProperty('--progress', 0);
      setTimeout(() => {
        ring.style.setProperty('--progress', progress);
      }, 100);
    }
  });
}

window.addEventListener('load', animateProgressRings);

