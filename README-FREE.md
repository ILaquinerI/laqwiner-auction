# LAQWINER AUCTION — FREE EDITION

Бесплатный вариант для тестирования: Render Free + Supabase Free.

## 1. Создай Supabase

1. Открой https://supabase.com/ и создай бесплатный проект.
2. Открой SQL Editor.
3. Вставь содержимое `supabase-schema.sql` и выполни.
4. Открой Project Settings → API.
5. Скопируй:
   - Project URL → `SUPABASE_URL`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

**service_role key никому не показывай и не вставляй в HTML.** Он нужен только серверу.

## 2. GitHub

Создай приватный или публичный репозиторий и загрузи содержимое этой папки.

## 3. Render

1. Открой https://render.com/.
2. New → Web Service.
3. Подключи GitHub-репозиторий.
4. Runtime: Node.
5. Build Command: `npm install`
6. Start Command: `npm start`
7. Plan: `Free`.
8. Добавь Environment Variables:
   - `ADMIN_PASSWORD` — придумай пароль админки
   - `SESSION_SECRET` — Render может сгенерировать автоматически
   - `SUPABASE_URL` — URL проекта Supabase
   - `SUPABASE_SERVICE_ROLE_KEY` — service_role key

Можно использовать `render.yaml`: Render предложит заполнить секретные значения.

## 4. Адреса после запуска

- `/` — сайт зрителя
- `/admin` — админка
- `/overlay` — OBS overlay

Render выдаст адрес вида `https://laqwiner-auction.onrender.com`.

## Важные ограничения бесплатного варианта

- Render Free может засыпать после 15 минут без входящего HTTP/WebSocket трафика.
- Файловая система Render Free непостоянная, поэтому состояние хранится в Supabase, а не в `auction-state.json`.
- Supabase Free может приостановить проект после длительного периода неактивности.
- Это вариант для теста/стримов, а не гарантия 24/7 production.

Когда понадобится постоянная работа, этот же проект можно перенести на VPS без переделки интерфейсов.


## v22 wheel rules
- The server selects the eliminated tank using Node.js crypto.randomInt.
- Every funded and still-alive tank has the same probability in the current dropout round.
- The wheel is visual only and runs for a fixed 20 seconds; the server result is authoritative.
- The public table labels the metric as 'Шанс выиграть'. Eliminated tanks show 0% / ВЫБЫЛ.


## v23
- Each tank has an independent `weight` field in admin.
- Winning probability = tank weight / sum of active funded tank weights.
- Donation amount is displayed separately and does not set the probability.
- Server-side selection uses Node.js `crypto.randomInt`.
- Overlay uses weighted sector sizes and a fixed 20-second spin.


## v44 UI updates
- Full-card country flag backgrounds for tank cards.
- Nation filters ordered like the game tech tree.
- Vehicle class filters ordered: light, medium, heavy, tank destroyer.
- Added a public tab for tanks where 3 marks have already been taken.
- Added admin control to mark/unmark a tank as having 3 marks.
- Canonical nation/class metadata for base tanks can no longer be overridden by stale Supabase values.
- Renamed public/admin labels from auction wording to challenge/support wording.
