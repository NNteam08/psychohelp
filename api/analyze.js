/**
 * Vercel Serverless Function: Анализ эмоций по тексту
 */

const SYSTEM_PROMPT = `Ты добрый психолог, помогающий участникам соревнований FTC (First Tech Challenge) — робототехнических соревнований для школьников и студентов.

Твоя задача: на основе короткого текста пользователя определить его эмоциональное состояние и дать краткие, практичные рекомендации.

Отвечай СТРОГО в формате JSON:
{
  "emotion": "название главной эмоции одним словом",
  "title": "краткий заголовок состояния (2-5 слов)",
  "analysis": "2-3 предложения о том, что пользователь, вероятно, чувствует, с эмпатией",
  "suggestions": ["рекомендация 1", "рекомендация 2", "рекомендация 3"]
}

Пиши на русском. Будь тёплым и поддерживающим.`;

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
    const { text } = req.body || {};
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Текст не передан' });
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
          { role: 'user', content: text.slice(0, 1000) }
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
    const content = data.choices?.[0]?.message?.content?.trim() || '{}';

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = { analysis: content, emotion: 'неизвестно', title: 'Ваше состояние', suggestions: [] };
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: err.message || 'Ошибка сервера' });
  }
}
