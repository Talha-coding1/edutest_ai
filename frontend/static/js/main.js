/* ============================================
   EduTest AI - Main JavaScript
   Global UI interactions
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  const icon = themeToggle?.querySelector('i');
  if (icon && document.body.classList.contains('light-mode')) {
    icon.className = 'fa-solid fa-sun';
  }
});

function showToast(message, type = 'info', duration = 2800) {
  const toast = document.createElement('div');
  const colors = {
    success: '#10b981',
    error: '#ef4444',
    info: '#3b82f6',
    warning: '#f59e0b',
  };
  toast.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 9999;
    background: ${colors[type] || colors.info};
    color: #fff;
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    transform: translateY(12px);
    opacity: 0;
    transition: all 0.2s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const themeToggle = document.getElementById('themeToggle');
const avatarMenu = document.querySelector('.topbar-avatar');

sidebarToggle?.addEventListener('click', () => {
  if (!sidebar) return;
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
  } else {
    sidebar.classList.toggle('collapsed');
  }
});

document.addEventListener('click', (e) => {
  if (!sidebar || !sidebarToggle) return;
  if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  }
});

window.addEventListener('resize', () => {
  if (window.innerWidth > 768) {
    sidebar?.classList.remove('open');
  }
});

themeToggle?.addEventListener('click', () => {
  document.body.classList.toggle('light-mode');
  const isLight = document.body.classList.contains('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  
  const icon = themeToggle.querySelector('i');
  if (!icon) return;
  icon.className = isLight ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
});

document.querySelectorAll('.nav-item').forEach((item) => {
  const label = item.querySelector('span')?.textContent || '';
  item.setAttribute('title', label);
});

const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
      }
    });
  },
  { threshold: 0.1 }
);

document
  .querySelectorAll('.feature-card, .timeline-card, .kpi-card, .quiz-card, .reco-card')
  .forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.45s ease, transform 0.45s ease';
    revealObserver.observe(el);
  });

avatarMenu?.addEventListener('click', () => {
  showToast('Profile options coming soon', 'info');
});

window.showToast = showToast;
