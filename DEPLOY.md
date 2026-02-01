# Деплой психоподдержки FTC

## 1. Git — первый коммит и push

```bash
git init
git add .
git commit -m "Психоподдержка FTC: текст + видео-анализ эмоций"
git branch -M main
git remote add origin https://github.com/ВАШ_ЮЗЕРНЕЙМ/психоподдержка-ftc.git
git push -u origin main
```

## 2. Деплой на Render (рекомендуется для Node.js)

1. Зарегистрируйтесь на [render.com](https://render.com)
2. New → Web Service
3. Подключите репозиторий GitHub
4. Настройки:
   - **Build Command:** `npm install` (или оставить пусто, если package.json без зависимостей)
   - **Start Command:** `node server.js`
   - **Environment:** Add Variable → `OPENAI_API_KEY` = ваш ключ

## 3. Деплой на Railway

```bash
npm install -g railway
railway login
railway init
railway add
railway variables set OPENAI_API_KEY=sk-ваш-ключ
railway up
```

## 4. Деплой на Vercel (нужна адаптация)

Vercel — serverless. Текущий `server.js` лучше подходит для Render/Railway. Для Vercel нужно вынести API в `api/` functions.

## 5. После push — добавьте OPENAI_API_KEY

На любой платформе в настройках сервиса добавьте переменную окружения:
- **OPENAI_API_KEY** = ваш ключ из .env (в Git его не коммитим)
