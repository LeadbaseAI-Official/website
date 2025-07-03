import { UserManager } from "../utility/app.js";

const API_URL = "https://api.leadbaseai.in";
const loadingOverlay = document.getElementById('loadingOverlay');

function showLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.add('visible');
  }
}

function hideLoading() {
  if (loadingOverlay) {
    loadingOverlay.classList.remove('visible');
  }
}

const questions = [
  {
    text: 'What best describes your current business type?',
    options: ['A. Pvt LTD', 'B. Agency/Service', 'C. Just Started', 'D. Small Scale']
  },
  {
    text: 'How many leads do you generate monthly?',
    options: ['A. 0-100', 'B. 100-500', 'C. 500-1000', 'D. 1000+']
  },
  {
    text: 'What’s your top outreach channel?',
    options: ['A. Email', 'B. LinkedIn', 'C. WhatsApp', 'D. Cold Calling']
  },
  {
    text: 'What’s your biggest challenge right now?',
    options: ['A. Lead Quality', 'B. Scaling Volume', 'C. Follow-ups', 'D. Manual Work']
  }
];

let currentIndex = 0;
let answers = [];

window.addEventListener('DOMContentLoaded', async () => {
  await UserManager.init();

  const nextBtn = document.getElementById('nextBtn');
  
  if (nextBtn) {
    nextBtn.addEventListener('click', handleNext);
  } else {
    console.error('Next button not found!');
  }
  
  loadQuestion();
});

function loadQuestion() {
  const q = questions[currentIndex];
  document.getElementById('question-text').textContent = q.text;

  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';

  q.options.forEach((opt, idx) => {
    const label = String.fromCharCode(65 + idx);
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.dataset.value = label;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      document.getElementById('nextBtn').disabled = false;
    });
    optionsDiv.appendChild(btn);
  });

  document.getElementById('nextBtn').disabled = true;
}

function handleNext() {
  const sel = document.querySelector('.option-btn.selected');
  if (!sel) return;
  
  answers.push(sel.dataset.value);
  currentIndex++;
  
  if (currentIndex < questions.length) {
    loadQuestion();
  } else {
    submitAnswers();
  }
}

async function submitAnswers() {
  const user = await UserManager.get();

  if (!user?.email || !user?.ip || !user?.name || !user?.phone) {
    alert('Missing user info — please log in again.');
    window.location.href = '../index.html';
    return;
  }

  showLoading();

  const payload = {
    email: user.email,
    ip: user.ip,
    name: user.name,
    phone: user.phone,
    question: answers.join(''),
    affiliate: 0
  };

  try {
    const res = await fetch(`${API_URL}/add-user`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
      if (result?.error?.toLowerCase().includes('already exists')) {
        console.warn('⚠️ User already exists, redirecting to dashboard...');
        user.verified = true;
        await UserManager.set(user);
        window.location.href = '../Dashboard/index.html';
        return;
      }
      throw new Error(result.error || 'Failed to submit answers');
    }

    // ✅ Normal case — user submitted successfully
    user.verified = true;
    await UserManager.set(user);
    alert('Thanks! Your answers were submitted successfully.');
    window.location.href = '../Dashboard/index.html';
  } catch (err) {
    console.error('Submit error:', err);
    alert('Submission failed. Please check your connection and try again.');
  } finally {
    hideLoading();
  }
}
