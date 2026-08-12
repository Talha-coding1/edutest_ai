/* ============================================
   EduTest AI – LLM Tutor Chat JS
   Real conversations: every message here round-trips
   to the server and is persisted, not simulated.
   ============================================ */

const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const chatMessages = document.getElementById('chatMessages');
const newChatBtn = document.getElementById('newChatBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const chatSidebarToggle = document.getElementById('chatSidebarToggle');
const chatSidebar = document.getElementById('chatSidebar');
const chatTopbarTitle = document.getElementById('chatTopbarTitle');
const chatStatus = document.getElementById('chatStatus');

let activeThreadId = chatMessages?.getAttribute('data-active-thread-id') || null;
if (activeThreadId === '') activeThreadId = null;
let isSending = false;

function getCsrfToken() {
  const input = document.querySelector('input[name=csrfmiddlewaretoken]');
  return input ? input.value : '';
}

// ---------- Auto-resize textarea ----------
chatInput?.addEventListener('input', () => {
  chatInput.style.height = 'auto';
  chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
});

// ---------- Send on Enter (Shift+Enter = new line) ----------
chatInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

sendBtn?.addEventListener('click', sendMessage);

// ---------- Quick prompt chips ----------
document.querySelectorAll('.prompt-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const prompt = chip.getAttribute('data-prompt');
    if (chatInput) {
      chatInput.value = prompt;
      chatInput.focus();
      sendMessage();
    }
  });
});

// -----------------------------------------------------------------------
// Real send flow: create a thread if needed, POST the message, render the
// real reply that comes back from the server.
// -----------------------------------------------------------------------
async function sendMessage() {
  const text = chatInput?.value.trim();
  if (!text || isSending) return;
  isSending = true;
  sendBtn.disabled = true;

  const welcome = document.querySelector('.chat-welcome');
  if (welcome) welcome.style.display = 'none';

  appendMessage(text, 'user');
  chatInput.value = '';
  chatInput.style.height = 'auto';

  if (chatStatus) chatStatus.style.display = 'inline-flex';
  const typingId = showTyping();

  try {
    if (!activeThreadId) {
      const res = await fetch('/chatbot/thread/new/', {
        method: 'POST',
        headers: { 'X-CSRFToken': getCsrfToken() },
      });
      const data = await res.json();
      if (!data.ok) throw new Error('Could not start a new thread');
      activeThreadId = data.thread_id;
      addThreadToSidebar(activeThreadId, data.title);
    }

    const res = await fetch(`/chatbot/thread/${activeThreadId}/message/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
      body: JSON.stringify({ content: text }),
    });
    const data = await res.json();
    removeTyping(typingId);

    if (!data.ok) {
      appendMessage(data.error || 'Something went wrong sending that message.', 'ai');
      return;
    }

    appendMessage(data.reply, 'ai');
    if (chatTopbarTitle) chatTopbarTitle.textContent = data.thread_title;
    updateThreadInSidebar(activeThreadId, data.thread_title, data.reply);

    if (!data.llm_ok) {
      showToast('LLM Tutor is not fully configured — see the message above for setup details.', 'info', 4000);
    }
  } catch (err) {
    removeTyping(typingId);
    appendMessage('Network error — could not reach the server. Please try again.', 'ai');
  } finally {
    if (chatStatus) chatStatus.style.display = 'none';
    isSending = false;
    sendBtn.disabled = false;
  }
}

function appendMessage(text, role) {
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const div = document.createElement('div');
  div.className = `message ${role === 'user' ? 'user-message' : 'ai-message'}`;

  if (role === 'user') {
    div.innerHTML = `
      <div class="message-avatar">
        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(window.CURRENT_USERNAME || 'User')}&background=6c63ff&color=fff&size=36" alt="User"/>
      </div>
      <div class="message-content">
        <div class="message-bubble">${escapeHtml(text)}</div>
        <span class="message-time">${time}</span>
      </div>`;
  } else {
    div.innerHTML = `
      <div class="message-avatar">
        <div class="ai-avatar-icon"><i class="fa-solid fa-brain"></i></div>
      </div>
      <div class="message-content">
        <div class="message-bubble">${escapeHtml(text).replace(/\n/g, '<br>')}</div>
        <div class="message-actions">
          <button class="msg-action-btn" title="Copy"><i class="fa-regular fa-copy"></i></button>
        </div>
        <span class="message-time">${time}</span>
      </div>`;
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  div.querySelector('.msg-action-btn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard!', 'success'));
  });
}

function showTyping() {
  const id = 'typing-' + Date.now();
  const div = document.createElement('div');
  div.className = 'message ai-message';
  div.id = id;
  div.innerHTML = `
    <div class="message-avatar">
      <div class="ai-avatar-icon"><i class="fa-solid fa-brain"></i></div>
    </div>
    <div class="message-content">
      <div class="message-bubble typing-bubble">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </div>
    </div>`;

  if (!document.getElementById('typing-style')) {
    const s = document.createElement('style');
    s.id = 'typing-style';
    s.textContent = `
      .typing-bubble { display:flex; gap:5px; align-items:center; padding:14px 18px !important; }
      .dot { width:8px; height:8px; border-radius:50%; background:var(--text-muted); animation: dotBounce 1.2s ease-in-out infinite; }
      .dot:nth-child(2) { animation-delay:0.2s; }
      .dot:nth-child(3) { animation-delay:0.4s; }
      @keyframes dotBounce { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-8px)} }
    `;
    document.head.appendChild(s);
  }

  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return id;
}

function removeTyping(id) {
  document.getElementById(id)?.remove();
}

function escapeHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// -----------------------------------------------------------------------
// Sidebar: real thread list management
// -----------------------------------------------------------------------
function addThreadToSidebar(threadId, title) {
  const list = document.getElementById('chatHistoryList');
  if (!list) return;
  const emptyNotice = list.querySelector('div:not(.chat-history-item)');
  if (emptyNotice) emptyNotice.remove();

  document.querySelectorAll('.chat-history-item').forEach(i => i.classList.remove('active'));

  const item = document.createElement('div');
  item.className = 'chat-history-item active';
  item.id = `conv-${threadId}`;
  item.setAttribute('data-thread-id', threadId);
  item.innerHTML = `
    <div class="conv-icon"><i class="fa-solid fa-brain"></i></div>
    <div class="conv-details">
      <span class="conv-title">${escapeHtml(title)}</span>
      <span class="conv-preview">No messages yet</span>
    </div>
    <span class="conv-time">now</span>
    <button class="conv-delete-btn" data-thread-id="${threadId}" aria-label="Delete thread">
      <i class="fa-solid fa-trash-can"></i>
    </button>`;
  list.insertBefore(item, list.firstChild);
  wireThreadItem(item);
}

function updateThreadInSidebar(threadId, title, lastMessage) {
  const item = document.getElementById(`conv-${threadId}`);
  if (!item) return;
  item.querySelector('.conv-title').textContent = title;
  item.querySelector('.conv-preview').textContent = lastMessage.slice(0, 40);
  item.querySelector('.conv-time').textContent = 'now';
  const list = document.getElementById('chatHistoryList');
  list.insertBefore(item, list.firstChild); // bump to top, like updated_at ordering
}

function wireThreadItem(item) {
  item.addEventListener('click', (e) => {
    if (e.target.closest('.conv-delete-btn')) return;
    loadThread(item.getAttribute('data-thread-id'));
  });
  item.querySelector('.conv-delete-btn')?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const threadId = item.getAttribute('data-thread-id');
    if (!confirm('Delete this conversation? This cannot be undone.')) return;
    await fetch(`/chatbot/thread/${threadId}/delete/`, {
      method: 'POST',
      headers: { 'X-CSRFToken': getCsrfToken() },
    });
    item.remove();
    if (String(activeThreadId) === String(threadId)) {
      activeThreadId = null;
      showWelcomeScreen();
    }
  });
}

document.querySelectorAll('.chat-history-item').forEach(wireThreadItem);

async function loadThread(threadId) {
  try {
    const res = await fetch(`/chatbot/thread/${threadId}/messages/`);
    const data = await res.json();
    if (!data.ok) return;

    activeThreadId = data.thread_id;
    document.querySelectorAll('.chat-history-item').forEach(i => i.classList.remove('active'));
    document.getElementById(`conv-${threadId}`)?.classList.add('active');
    if (chatTopbarTitle) chatTopbarTitle.textContent = data.title;

    chatMessages.innerHTML = '';
    if (data.messages.length === 0) {
      showWelcomeScreen(false);
    } else {
      data.messages.forEach(m => appendMessage(m.content, m.role === 'user' ? 'user' : 'ai'));
    }
  } catch (err) {
    showToast('Could not load that conversation', 'error');
  }
}

function showWelcomeScreen(resetInput = true) {
  chatMessages.innerHTML = `<div class="chat-welcome">
    <div class="welcome-icon"><i class="fa-solid fa-robot"></i></div>
    <h2>Hello! I'm <span class="gradient-text">EduTest AI</span></h2>
    <p>Your software testing learning assistant. Ask me anything!</p>
  </div>`;
  if (chatTopbarTitle) chatTopbarTitle.textContent = 'New Conversation';
  if (resetInput && chatInput) chatInput.value = '';
}

// ---------- New chat ----------
newChatBtn?.addEventListener('click', () => {
  activeThreadId = null;
  document.querySelectorAll('.chat-history-item').forEach(i => i.classList.remove('active'));
  showWelcomeScreen();
});

// ---------- Clear chat (starts a fresh thread, doesn't delete history) ----------
clearChatBtn?.addEventListener('click', () => {
  newChatBtn?.click();
  showToast('Started a new conversation', 'info');
});

// ---------- Search threads (client-side filter) ----------
document.getElementById('chatSearch')?.addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  document.querySelectorAll('.chat-history-item').forEach(item => {
    const title = item.querySelector('.conv-title')?.textContent.toLowerCase() || '';
    const preview = item.querySelector('.conv-preview')?.textContent.toLowerCase() || '';
    item.style.display = (title.includes(q) || preview.includes(q)) ? '' : 'none';
  });
});

// ---------- Mobile sidebar toggle ----------
chatSidebarToggle?.addEventListener('click', () => {
  chatSidebar?.classList.toggle('open');
});

// ---------- Export chat (real .docx, generated server-side) ----------
document.getElementById('exportChatBtn')?.addEventListener('click', () => {
  if (!activeThreadId) {
    showToast('Nothing to export yet', 'info');
    return;
  }
  window.location.href = `/chatbot/thread/${activeThreadId}/export/`;
  showToast('Preparing Word document...', 'info');
});
