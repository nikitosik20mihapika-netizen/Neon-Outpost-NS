# Neon Outpost — бесплатный онлайн (лобби)

Простой WebSocket-сервер: комнаты до 6 игроков, позиции, чат.

## 1. Деплой на Render (бесплатно)

1. Зарегистрируйся на https://render.com  
2. **New → Web Service**  
3. Подключи GitHub-репозиторий с этой папкой **или** загрузи через "Deploy from existing image" / Blueprint  
   Проще: создай репозиторий с файлами `server.js` + `package.json`  
4. Настройки:
   - **Runtime:** Node  
   - **Build command:** `npm install`  
   - **Start command:** `npm start`  
   - **Instance type:** Free  
5. После деплоя будет URL вида:  
   `https://neon-outpost-xxxx.onrender.com`  
   WebSocket: `wss://neon-outpost-xxxx.onrender.com`

Проверка в браузере: открой `https://...onrender.com/health` — должно быть `{"ok":true,...}`.

### Важно про Free на Render
- Сервис **засыпает** ~после 15 мин без запросов  
- Первый вход после сна: **30–60 секунд**  
- Для альфы нормально; для постоянки позже — дешёвый VPS

## 2. Локальный тест

```bash
cd online-server
npm install
npm start
```

Клиент: `ws://localhost:3000`

## 3. Подключение игры

В `neon_outpost.html` укажи:

```js
const ONLINE_URL = 'wss://ТВОЙ-СЕРВИС.onrender.com';
```

Дальше — кнопки «Онлайн» в меню (можно попросить Grok встроить в билд).

## 4. Альтернативы free
- **Fly.io** — `fly launch` + `fly deploy`  
- **Railway** — trial credits  

Для аудитории из РФ free-хостинг за рубежом обычно открывается **без VPN**, но маршрут бывает разный. Если free нестабилен — VPS в РФ ~150–300₽/мес.
