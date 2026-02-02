/**
 * Сервер-прокси для GPT API — распознавание эмоций
 * Запуск: npm run server
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Загрузка .env
const envPaths = [
  path.join(__dirname, '.env'),
  path.join(process.cwd(), '.env')
];
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
    for (const line of content.split('\n')) {
      const eq = line.indexOf('=');
      if (eq > 0) {
        const key = line.slice(0, eq).trim();
        const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (key && val) process.env[key] = val;
      }
    }
    break;
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const SYSTEM_PROMPT_TEXT = `Ты добрый психолог, помогающий участникам соревнований FTC (First Tech Challenge) — робототехнических соревнований для школьников и студентов.

Твоя задача: на основе короткого текста пользователя определить его эмоциональное состояние и дать краткие, практичные рекомендации.

Отвечай СТРОГО в формате JSON:
{
  "emotion": "название главной эмоции одним словом",
  "title": "краткий заголовок состояния (2-5 слов)",
  "analysis": "2-3 предложения о том, что пользователь, вероятно, чувствует, с эмпатией",
  "suggestions": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}

Пиши на русском. Будь тёплым и поддерживающим. Recommendations должны быть конкретными и выполнимыми (перерывы, дыхание, разговор с командой и т.д.).`;

const SYSTEM_PROMPT_VIDEO = `Ты добрый психолог, помогающий участникам соревнований FTC. Твоя задача: по кадрам с лицом человека определить его эмоциональное состояние (мимика, выражение лица) и дать краткие рекомендации.

Отвечай СТРОГО в формате JSON:
{
  "emotion": "название главной эмоции одним словом",
  "title": "краткий заголовок (2-5 слов)",
  "analysis": "2-3 предложения о наблюдаемом состоянии, с эмпатией",
  "suggestions": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}

Пиши на русском. Будь тёплым. Если лицо не видно или изображение unclear — напиши об этом в analysis.`;

async function callOpenAI(text) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_TEXT },
        { role: 'user', content: text }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API: ${res.status} - ${err}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '{}';

  try {
    return JSON.parse(content);
  } catch {
    return { analysis: content, emotion: 'неизвестно', title: 'Ваше состояние', suggestions: [] };
  }
}

async function callOpenAIVision(images) {
  const content = [
    { type: 'text', text: 'Проанализируй эмоциональное состояние человека на этих кадрах. Определи главную эмоцию и дай рекомендации.' }
  ];
  for (const img of images.slice(0, 5)) {
    const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    content.push({ type: 'image_url', image_url: { url } });
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT_VIDEO },
        { role: 'user', content }
      ],
      temperature: 0.7,
      max_tokens: 500
    })
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API: ${res.status} - ${err}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '{}';
  try {
    return JSON.parse(text);
  } catch {
    return { analysis: text, emotion: 'неизвестно', title: 'Состояние', suggestions: [] };
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ico': 'image/x-icon'
};

const server = http.createServer(async (req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  const ext = path.extname(url);

  if (!OPENAI_API_KEY && req.method === 'POST' && (url === '/api/analyze' || url === '/api/analyze-video')) {
    let body = '';
    for await (const chunk of req) body += chunk;
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'OPENAI_API_KEY не задан. Создайте файл .env с ключом.' }));
    return;
  }

  if (req.method === 'POST' && url === '/api/analyze') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { text } = JSON.parse(body || '{}');
      if (!text || typeof text !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Текст не передан' }));
        return;
      }
      const result = await callOpenAI(text.slice(0, 1000));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Ошибка анализа' }));
    }
    return;
  }

  if (req.method === 'POST' && url === '/api/analyze-video') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const { images } = JSON.parse(body || '{}');
      if (!Array.isArray(images) || images.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Изображения не переданы' }));
        return;
      }
      const result = await callOpenAIVision(images);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Ошибка анализа видео' }));
    }
    return;
  }

  // Статика
  const filePath = path.join(__dirname, url.replace(/\?.*$/, ''));
  if (!filePath.startsWith(__dirname) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const fallback = path.join(__dirname, 'index.html');
    const html = fs.readFileSync(fallback, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }

  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(content);
});

server.listen(PORT, () => {
  console.log(`\n🌸 Психоподдержка FTC: http://localhost:${PORT}\n`);
  if (OPENAI_API_KEY) {
    console.log(`✅ OPENAI_API_KEY обнаружен (${OPENAI_API_KEY.slice(0,8)}...)\n`);
  } else {
    console.log('⚠️  OPENAI_API_KEY не найден. Добавьте переменную окружения.\n');
  }
});
