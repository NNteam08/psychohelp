/**
 * Vercel Serverless Function: Анализ эмоций по видео/изображениям
 */

const SYSTEM_PROMPT = `Ты добрый психолог, помогающий участникам соревнований FTC. Твоя задача: по кадрам с лицом человека определить его эмоциональное состояние (мимика, выражение лица) и дать краткие рекомендации.

Отвечай СТРОГО в формате JSON:
{
  "emotion": "название главной эмоции одним словом",
  "title": "краткий заголовок (2-5 слов)",
  "analysis": "2-3 предложения о наблюдаемом состоянии, с эмпатией",
  "suggestions": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}

Пиши на русском. Будь тёплым. Если лицо не видно или изображение unclear — напиши об этом в analysis.`;

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'OPENAI_API_KEY не настроен на сервере' });
  }

  try {
    const { images } = req.body || {};
    if (!Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: 'Изображения не переданы' });
    }

    const content = [
      { type: 'text', text: 'Проанализируй эмоциональное состояние человека на этих кадрах. Определи главную эмоцию и дай рекомендации.' }
    ];

    for (const img of images.slice(0, 5)) {
      const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
      content.push({ type: 'image_url', image_url: { url } });
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content }
        ],
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('OpenAI error:', errText);
      return res.status(500).json({ error: `OpenAI API ошибка: ${response.status}` });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || '{}';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { analysis: text, emotion: 'неизвестно', title: 'Состояние', suggestions: [] };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка сервера' });
  }
}
