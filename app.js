/**
 * Психоподдержка FTC — распознавание эмоций через GPT API (текст + видео)
 */

const emotionInput = document.getElementById('emotionInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const resultArea = document.getElementById('resultArea');
const resultEmoji = document.getElementById('resultEmoji');
const resultTitle = document.getElementById('resultTitle');
const resultContent = document.getElementById('resultContent');
const resultSuggestions = document.getElementById('resultSuggestions');

const API_ANALYZE = '/api/analyze';
const API_VIDEO = '/api/analyze-video';

let capturedFrame = null;
let videoStream = null;

const EMOTION_EMOJIS = {
  тревога: '😰',
  беспокойство: '😟',
  стресс: '😓',
  усталость: '😴',
  грусть: '😢',
  радость: '😊',
  волнение: '🤩',
  страх: '😨',
  злость: '😤',
  спокойствие: '😌',
  растерянность: '😕',
  надежда: '✨',
  благодарность: '🙏',
  default: '💭'
};

function getEmojiForEmotion(text) {
  const lower = text.toLowerCase();
  for (const [key, emoji] of Object.entries(EMOTION_EMOJIS)) {
    if (key !== 'default' && lower.includes(key)) return emoji;
  }
  return EMOTION_EMOJIS.default;
}

function setLoading(loading) {
  analyzeBtn.disabled = loading;
  analyzeBtn.classList.toggle('loading', loading);
}

function showResult(emoji, title, content, suggestions) {
  resultEmoji.textContent = emoji;
  resultTitle.textContent = title;
  resultContent.innerHTML = content;
  resultSuggestions.innerHTML = suggestions || '';
  resultArea.classList.remove('hidden');
  resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function showError(message) {
  showResult(
    '😔',
    'Не удалось проанализировать',
    `<p>${message}</p>`,
    '<p><strong>Что сделать:</strong> Проверьте, что сервер запущен и в .env указан корректный OPENAI_API_KEY.</p>'
  );
}

async function analyzeEmotion() {
  const text = emotionInput.value.trim();
  if (!text) {
    emotionInput.focus();
    return;
  }

  setLoading(true);
  resultArea.classList.add('hidden');

  try {
    const res = await fetch(API_ANALYZE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const text2 = await res.text();
    let data;
    try {
      data = JSON.parse(text2);
    } catch {
      throw new Error(`Сервер вернул некорректный ответ: ${text2.slice(0, 100)}`);
    }

    if (!res.ok) {
      throw new Error(data.error || `Ошибка ${res.status}`);
    }

    const emoji = getEmojiForEmotion(data.emotion || '');
    const suggestions = data.suggestions
      ? `<p><strong>Рекомендации:</strong></p><ul>${data.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '';

    showResult(
      emoji,
      data.title || 'Ваше эмоциональное состояние',
      `<p>${data.analysis || data.content}</p>`,
      suggestions
    );
  } catch (err) {
    const msg = err.message || 'Не удалось подключиться к серверу. Запустите: <code>npm run server</code>';
    showError(msg);
  } finally {
    setLoading(false);
  }
}

analyzeBtn.addEventListener('click', analyzeEmotion);

emotionInput.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'Enter') analyzeEmotion();
});

// === Tabs ===
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.getElementById(tab === 'text' ? 'tabText' : 'tabVideo').classList.add('active');
    resultArea.classList.add('hidden');
    if (tab === 'video') initWebcam();
    else stopWebcam();
  });
});

// === Video source toggle ===
document.querySelectorAll('input[name="videoSource"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isWebcam = radio.value === 'webcam';
    document.getElementById('webcamArea').classList.toggle('hidden', !isWebcam);
    document.getElementById('fileArea').classList.toggle('hidden', isWebcam);
    capturedFrame = null;
    if (isWebcam) initWebcam();
    else stopWebcam();
  });
});

// === Webcam ===
const webcamVideo = document.getElementById('webcamVideo');
const captureBtn = document.getElementById('captureBtn');
const analyzeVideoBtn = document.getElementById('analyzeVideoBtn');
const videoFileInput = document.getElementById('videoFile');

function initWebcam() {
  stopWebcam();
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640 } })
    .then(stream => {
      videoStream = stream;
      webcamVideo.srcObject = stream;
      webcamVideo.style.display = 'block';
    })
    .catch(() => {
      webcamVideo.style.display = 'none';
      captureBtn.textContent = 'Нет доступа к камере';
    });
}

function stopWebcam() {
  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }
  webcamVideo.srcObject = null;
  webcamVideo.style.display = 'none';
}

function captureFromWebcam() {
  const canvas = document.createElement('canvas');
  canvas.width = webcamVideo.videoWidth;
  canvas.height = webcamVideo.videoHeight;
  canvas.getContext('2d').drawImage(webcamVideo, 0, 0);
  return canvas.toDataURL('image/jpeg', 0.85);
}

captureBtn.addEventListener('click', () => {
  if (webcamVideo.readyState >= 2) {
    capturedFrame = captureFromWebcam();
    captureBtn.textContent = 'Кадр сохранён ✓';
    setTimeout(() => { captureBtn.textContent = 'Снять кадр'; }, 2000);
  }
});

// === Video file: extract frames ===
function extractFramesFromVideo(videoFile) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      const duration = video.duration;
      const count = Math.min(3, Math.max(1, Math.floor(duration / 3)));
      const times = [];
      for (let i = 0; i < count; i++) {
        times.push((duration * (i + 1)) / (count + 1));
      }
      const frames = [];
      let processed = 0;

      const seek = (idx) => {
        if (idx >= times.length) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = times[idx];
      };

      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        frames.push(canvas.toDataURL('image/jpeg', 0.8));
        processed++;
        seek(processed);
      };

      video.onerror = () => reject(new Error('Ошибка загрузки видео'));
      seek(0);
    };

    video.src = URL.createObjectURL(videoFile);
  });
}

// === Analyze video ===
async function analyzeVideo() {
  const isWebcam = document.querySelector('input[name="videoSource"]:checked').value === 'webcam';
  let images = [];

  if (isWebcam) {
    if (!capturedFrame) {
      if (webcamVideo.readyState >= 2) capturedFrame = captureFromWebcam();
      else {
        alert('Сначала нажмите «Снять кадр»');
        return;
      }
    }
    images = [capturedFrame];
  } else {
    const file = videoFileInput.files[0];
    if (!file) {
      alert('Выберите видеофайл');
      return;
    }
    try {
      images = await extractFramesFromVideo(file);
    } catch (e) {
      showError(e.message || 'Не удалось обработать видео');
      return;
    }
  }

  analyzeVideoBtn.disabled = true;
  analyzeVideoBtn.classList.add('loading');
  resultArea.classList.add('hidden');

  try {
    const res = await fetch(API_VIDEO, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images })
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(`Сервер вернул некорректный ответ: ${text.slice(0, 100)}`);
    }

    if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);

    const emoji = getEmojiForEmotion(data.emotion || '');
    const suggestions = data.suggestions?.length
      ? `<p><strong>Рекомендации:</strong></p><ul>${data.suggestions.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '';

    showResult(
      emoji,
      data.title || 'Эмоциональное состояние',
      `<p>${data.analysis || data.content || ''}</p>`,
      suggestions
    );
  } catch (err) {
    showError(err.message);
  } finally {
    analyzeVideoBtn.disabled = false;
    analyzeVideoBtn.classList.remove('loading');
  }
}

analyzeVideoBtn.addEventListener('click', analyzeVideo);

// Init webcam if video tab is shown on load (hidden by default)
if (document.getElementById('tabVideo').classList.contains('active')) initWebcam();
