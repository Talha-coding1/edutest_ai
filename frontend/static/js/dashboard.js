/* ============================================
   EduTest AI – Dashboard JS
   Charts are built from real per-user data
   rendered server-side via json_script.
   ============================================ */

window.addEventListener('DOMContentLoaded', () => {
  initActivityChart();
  initTopicsChart();
});

function readJsonScript(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    return null;
  }
}

function initActivityChart() {
  const ctx = document.getElementById('activityChart');
  if (!ctx) return;

  const trend = readJsonScript('score-trend-data');
  if (!trend || !trend.labels || trend.labels.length === 0) return;

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: trend.labels,
      datasets: [
        {
          label: 'Overall Score',
          data: trend.data,
          borderColor: '#5b8def',
          backgroundColor: 'rgba(91,141,239,0.07)',
          borderWidth: 2.5,
          pointBackgroundColor: '#5b8def',
          pointRadius: 4,
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#636b8a' },
        },
        y: {
          min: 0,
          max: 100,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#636b8a', callback: (v) => v + '%' },
          beginAtZero: true,
        },
      },
    },
  });
}

function initTopicsChart() {
  const ctx = document.getElementById('topicsChart');
  if (!ctx) return;

  const cats = readJsonScript('category-averages-data');
  if (!cats || Object.keys(cats).length === 0) return;

  const labels = Object.keys(cats);
  const data = Object.values(cats);
  const palette = ['#5b8def', '#ff5c6c', '#00e0a1', '#ffaa3b', '#a78bfa', '#38bdf8'];

  new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 0,
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ea4c1', padding: 16, boxWidth: 12, borderRadius: 4 },
        },
        tooltip: {
          callbacks: { label: (item) => `${item.label}: ${item.raw}% avg` },
        },
      },
    },
  });
}
