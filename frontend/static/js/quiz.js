/* ============================================
   NeuralChat AI – Quiz Page JS
   ============================================ */

// ---------- Category Filter ----------
document.querySelectorAll('.category-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');

    const category = chip.getAttribute('data-category');
    const cards = document.querySelectorAll('#quizGrid .quiz-card[data-category]');
    let visibleCount = 0;

    cards.forEach(card => {
      const matches = category === 'all' || card.getAttribute('data-category') === category;
      card.style.display = matches ? '' : 'none';
      if (matches) visibleCount++;
    });

    let emptyMsg = document.getElementById('categoryEmptyState');
    if (visibleCount === 0) {
      if (!emptyMsg) {
        emptyMsg = document.createElement('div');
        emptyMsg.id = 'categoryEmptyState';
        emptyMsg.className = 'quiz-empty-state';
        emptyMsg.innerHTML = `
          <div class="quiz-empty-icon"><i class="fa-solid fa-face-smile"></i></div>
          <h3>No quizzes in this topic yet</h3>
          <p>Try a different topic or switch back to All Topics.</p>`;
        document.getElementById('quizGrid').appendChild(emptyMsg);
      }
      emptyMsg.style.display = '';
    } else if (emptyMsg) {
      emptyMsg.style.display = 'none';
    }
  });
});

// ---------- Open Quiz Modal ----------
let currentQuizMeta = null;
let questions = [];       // fetched fresh per quiz — real, topic-specific content
let currentQuestion = 0;
const userAnswers = {};   // { questionIndex: selectedChoiceIndex }

document.querySelectorAll('.quiz-start-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const card = btn.closest('.quiz-card');
    currentQuizMeta = card ? {
      id: card.getAttribute('data-quiz-id'),
      title: card.getAttribute('data-quiz-title'),
      minutes: parseInt(card.getAttribute('data-minutes'), 10) || 0,
    } : null;
    if (!currentQuizMeta || !currentQuizMeta.id) return;

    let data;
    try {
      const res = await fetch(`/quiz/${currentQuizMeta.id}/questions/`);
      data = await res.json();
    } catch (err) {
      showToast('Could not load this quiz — check your connection and try again.', 'error');
      return;
    }
    if (!data.ok || !data.questions || !data.questions.length) {
      showToast(data.error || 'This quiz has no questions yet.', 'error');
      return;
    }

    questions = data.questions;      // [{id, order, text, choices}] — no answer key included
    currentQuestion = 0;
    Object.keys(userAnswers).forEach(k => delete userAnswers[k]);
    Object.keys(questionFeedback).forEach(k => delete questionFeedback[k]);

    const overlay = document.getElementById('quizModalOverlay');
    overlay.classList.add('active');
    document.getElementById('nextQBtn').innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
    renderQuestion(0);
    startTimer(600); // 10 minutes
  });
});

document.getElementById('closeQuizModal')?.addEventListener('click', () => {
  document.getElementById('quizModalOverlay').classList.remove('active');
  clearInterval(timerInterval);
});

document.getElementById('quizModalOverlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    e.currentTarget.classList.remove('active');
    clearInterval(timerInterval);
  }
});

// ---------- Timer ----------
let timerInterval;
function startTimer(seconds) {
  clearInterval(timerInterval);
  let remaining = seconds;
  const timerEl = document.getElementById('quizTimer');
  timerInterval = setInterval(() => {
    remaining--;
    const m = Math.floor(remaining / 60).toString().padStart(2, '0');
    const s = (remaining % 60).toString().padStart(2, '0');
    if (timerEl) timerEl.textContent = `${m}:${s}`;
    if (remaining <= 0) {
      clearInterval(timerInterval);
      showToast('Time is up!', 'error');
      document.getElementById('quizModalOverlay').classList.remove('active');
    }
  }, 1000);
}

// ---------- Questions ----------
// Fetched fresh per quiz from /quiz/<id>/questions/ — see the
// quiz-start-btn handler above. No hardcoded content here anymore.

const questionFeedback = {}; // { questionIndex: {correct, correctIndex, explanation} }

function renderQuestion(idx) {
  const q = questions[idx];
  if (!q) return;
  document.getElementById('quizQuestion').innerHTML = q.text;
  document.getElementById('currentQ').textContent = idx + 1;
  document.getElementById('totalQ').textContent = questions.length;
  document.getElementById('qProgressFill').style.width = `${((idx + 1) / questions.length) * 100}%`;

  const optLabels = ['A', 'B', 'C', 'D'];
  document.querySelectorAll('.quiz-option').forEach((opt, i) => {
    const label = opt.querySelector('.option-label');
    const text = opt.querySelector('.option-text');
    const radio = opt.querySelector('input[type="radio"]');
    if (label) label.textContent = optLabels[i];
    if (text) text.textContent = q.choices[i] || '';
    if (radio) {
      radio.value = i;
      radio.checked = userAnswers[idx] === i;
    }
    opt.classList.remove('correct-answer', 'wrong-answer', 'answered');
  });

  const feedbackBox = document.getElementById('quizAnswerFeedback');
  if (questionFeedback[idx]) {
    applyAnswerFeedback(idx, userAnswers[idx]);
  } else if (feedbackBox) {
    feedbackBox.style.display = 'none';
  }
}

// Colors the selected option and (if wrong) the correct option, and shows
// the explanation box. Called immediately after answering, and again when
// navigating back to an already-answered question.
function applyAnswerFeedback(idx, selectedChoiceIdx) {
  const fb = questionFeedback[idx];
  if (!fb) return;

  document.querySelectorAll('.quiz-option').forEach((opt, i) => {
    opt.classList.add('answered');
    if (i === fb.correctIndex) {
      opt.classList.add('correct-answer');
    } else if (i === selectedChoiceIdx) {
      opt.classList.add('wrong-answer');
    }
  });

  const feedbackBox = document.getElementById('quizAnswerFeedback');
  const verdictEl = document.getElementById('quizFeedbackVerdict');
  const explanationEl = document.getElementById('quizFeedbackExplanation');
  if (feedbackBox && verdictEl && explanationEl) {
    verdictEl.textContent = fb.correct ? '✓ Correct' : '✗ Not quite';
    verdictEl.className = `quiz-feedback-verdict ${fb.correct ? 'is-correct' : 'is-wrong'}`;
    explanationEl.textContent = fb.explanation || '';
    feedbackBox.style.display = '';
  }
}

document.querySelectorAll('.quiz-option input').forEach(radio => {
  radio.addEventListener('change', async () => {
    const idx = currentQuestion;
    const choiceIdx = parseInt(radio.value, 10);
    if (questionFeedback[idx]) return; // already answered — locked

    userAnswers[idx] = choiceIdx;
    const q = questions[idx];
    if (!q) return;

    try {
      const res = await fetch(`/quiz/question/${q.id}/check/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
        body: JSON.stringify({ selected: choiceIdx }),
      });
      const data = await res.json();
      if (!data.ok) return;
      questionFeedback[idx] = { correct: data.correct, correctIndex: data.correct_index, explanation: data.explanation };
      applyAnswerFeedback(idx, choiceIdx);
    } catch (err) {
      // Feedback is a nice-to-have — if it fails, the learner can still
      // finish the quiz normally and see their overall score at the end.
    }
  });
});

document.getElementById('nextQBtn')?.addEventListener('click', () => {
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    renderQuestion(currentQuestion);
  } else {
    finishQuiz();
  }
  const isLast = currentQuestion === questions.length - 1;
  document.getElementById('nextQBtn').innerHTML = isLast
    ? 'Submit <i class="fa-solid fa-check"></i>'
    : 'Next <i class="fa-solid fa-arrow-right"></i>';
});

document.getElementById('prevQBtn')?.addEventListener('click', () => {
  if (currentQuestion > 0) {
    currentQuestion--;
    renderQuestion(currentQuestion);
  }
  document.getElementById('nextQBtn').innerHTML = 'Next <i class="fa-solid fa-arrow-right"></i>';
});

function getCsrfToken() {
  const input = document.querySelector('input[name=csrfmiddlewaretoken]');
  return input ? input.value : '';
}

function finishQuiz() {
  clearInterval(timerInterval);
  document.getElementById('quizModalOverlay').classList.remove('active');

  if (!currentQuizMeta || !currentQuizMeta.id) return;

  // Map {questionIndex: choiceIndex} -> {questionId: choiceIndex} — the
  // server grades against QuizQuestion.correct_index by real question id,
  // since the answer key was never sent to the client in the first place.
  const answersByQuestionId = {};
  Object.entries(userAnswers).forEach(([idx, choiceIdx]) => {
    const q = questions[idx];
    if (q) answersByQuestionId[q.id] = choiceIdx;
  });

  fetch('/quiz/complete/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCsrfToken() },
    body: JSON.stringify({ quiz_id: currentQuizMeta.id, answers: answersByQuestionId }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (!data.ok) {
        showToast(data.error || 'Could not submit this quiz — try again.', 'error');
        return;
      }
      showToast(`Quiz complete! Score: ${data.score_percent}% (${data.correct_count}/${data.total_questions})`, 'success');
      const gs = data.goal_status;
      setTimeout(() => {
        showToast(`+${data.minutes_logged} min logged toward your daily goal`, 'info', 3000);
      }, 800);
      if (gs && gs.goal_reached) {
        setTimeout(() => {
          showToast(`🎉 Daily goal complete! ${gs.minutes_completed_today}/${gs.goal_minutes} min — you can set a new goal on your Profile.`, 'success', 4500);
        }, 1800);
      }
      // Reload so the Daily Goal banner / quiz list reflect the new
      // remaining time (and the Profile slider unlocks if goal was met).
      setTimeout(() => window.location.reload(), 2600);
    })
    .catch(() => {});
}

// Questions are rendered once fetched — see the quiz-start-btn handler above.
