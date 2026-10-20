# Деплой: GitHub Actions → GHCR → сервер (Docker)

Сборка идёт в GitHub. На сервере нет исходников и `node_modules` — только готовые образы
и конфиги в `/opt/anticore` (для стенда — своя папка).

```
push в master (оба репо) ─► проверки (tsc, тесты) ─► сборка образа ─► ghcr.io/1nspie/anticore-{server,client}:<sha>  (+ latest)
                            └─ само на сервер НЕ выкатывается (если не включён AUTO_DEPLOY_PRODUCTION)

Run workflow (любая ветка + stand / production) ─► то же самое ─► ssh: pull → [prisma migrate deploy] → up -d --wait
                                                                   └─ не стал healthy → автоматический откат на прошлый образ
```

Контейнеры работают в `network_mode: host` на тех же портах, что раньше pm2 (API — `PORT` из `server.env`, фронт — `CLIENT_PORT`),
поэтому **nginx и Postgres не перенастраиваются**.

## Как выкатить

1. GitHub → репозиторий → **Actions** → «Build & deploy server» (или «…client») → **Run workflow**.
2. **Use workflow from** — выбрать нужную ветку (хоть feature-ветку).
3. **environment**: `stand` — на стенд, `production` — на прод, `none` — только собрать образ.
4. Порядок: **сначала сервер, потом клиент** (клиент зависит от новых эндпоинтов и миграций).

Перед сборкой всегда идут проверки: `tsc` (оба репо) и тесты (сервер). Красные — образ не собирается и не выкатывается.

- **Автовыкладка прода при push в master** выключена. Включить: Settings → Secrets and variables → Actions → **Variables** →
  `AUTO_DEPLOY_PRODUCTION = true`.
- **Теги образов:** `<sha>` — всегда; `latest` — только сборки из `master`. Клиент для стенда собирается отдельно: `<sha>-stand`
  (адреса API и сайта вшиваются в JS при сборке, поэтому образ стенда нельзя запускать на проде и наоборот).
- **Миграции** на сервере выполняются автоматически перед перезапуском бэка (`prisma migrate deploy`). Откат образа миграции **не откатывает**.

## Файлы

| Где | Что |
|---|---|
| `anticore-server/Dockerfile`, `anticore-client/Dockerfile` | сборка образов (Node 24) |
| `*/.github/workflows/deploy.yml` | проверки → сборка → (по выбору) выкладка |
| `deploy/docker-compose.yml` | копируется на сервер в `/opt/anticore/` (или папку стенда); healthcheck обоих сервисов |
| `deploy/.env.deploy.example` | какие теги образов запущены (CI обновляет сам) и `CLIENT_PORT` |
| `deploy/server.env.example` | **все** переменные бэка с пояснениями: что обязательно, что нет |
| `deploy/client.env.example` | runtime-переменные фронта |

---

## Настройка GitHub (один раз)

### Окружения `stand` и `production`

Settings → **Environments** → создать `stand` и `production`. В **каждом** — свои **Secrets**:

| Secret | Значение |
|---|---|
| `DEPLOY_HOST` | IP/домен сервера |
| `DEPLOY_USER` | пользователь для SSH (`deploy`) |
| `DEPLOY_SSH_KEY` | приватный ключ (см. «SSH-ключ» ниже) |
| `DEPLOY_PORT` | порт SSH, если не 22 (необязательно) |
| `DEPLOY_PATH` | папка с compose на сервере. По умолчанию `/opt/anticore`; для стенда на одном сервере с продом — `/opt/anticore-stand` |

В окружении `production` удобно включить **Required reviewers** — выкладка на прод будет ждать подтверждения.
Секреты добавлять в **обоих** репозиториях (сервер и клиент).

### Variables клиента (только репозиторий anticore-client)

Вшиваются в JS при сборке: поменял значение → перезапусти workflow.

| Прод | Стенд (приоритет над прод-значением) | Пример |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_API_URL` | **`STAND_NEXT_PUBLIC_BACKEND_API_URL`** — обязательна | `https://example.ru/api` |
| `SITE_LINK` | **`STAND_SITE_LINK`** — обязательна | `https://example.ru` |
| `NEXT_PUBLIC_S3_URL` | `STAND_NEXT_PUBLIC_S3_URL` (если нет — как на проде) | публичный домен бакета |
| `NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY` | `STAND_NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY` | `ysc1_…` |
| `NEXT_PUBLIC_REACT_APP_YMAP_KEY` | `STAND_NEXT_PUBLIC_REACT_APP_YMAP_KEY` | ключ Яндекс.Карт |
| `USE_YANDEX_METRICS` | `STAND_USE_YANDEX_METRICS` (по умолчанию `false`) | `true` |

Для стенда адрес API и сайта обязаны быть **свои** — без них сборка стенда падает с понятной ошибкой,
чтобы стенд случайно не пошёл в боевой API.

---

## Первый запуск прода (один раз)

### 1. Сервер

```bash
# Docker + compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy        # пользователь, под которым ходит CI

sudo mkdir -p /opt/anticore && sudo chown -R deploy: /opt/anticore
```

Скопировать в `/opt/anticore/`:

- `docker-compose.yml` (из `deploy/`)
- `.env.deploy` (из `.env.deploy.example`)
- `server.env` — по образцу `server.env.example`; для прода можно взять текущий `.env` бэка, **сняв кавычки** со значений
  (Docker не снимает их, в отличие от dotenv). `DATABASE_URL` целиком, без `${...}`. Хост БД — `localhost` (работает благодаря `network_mode: host`).
- `client.env` (из `client.env.example`)

Картинок и видео на сервере нет — всё лежит в Selectel S3 (см. «Медиа» ниже). Папка `data/` не нужна.

### 2. Доступ сервера к образам (GHCR)

Образы приватные. На GitHub: Settings → Developer settings → Personal access tokens (classic) → токен
только с `read:packages`. На сервере:

```bash
echo <TOKEN> | docker login ghcr.io -u <github-логин> --password-stdin
```

### 3. SSH-ключ для CI

```bash
ssh-keygen -t ed25519 -f deploy_key -N "" -C "github-actions"
# deploy_key.pub → ~deploy/.ssh/authorized_keys на сервере
# deploy_key (приватный) → секрет DEPLOY_SSH_KEY в окружениях GitHub, затем удалить локально
```

### 4. ⚠️ Миграции Prisma на проде (проверить до первой выкладки)

Раньше схема применялась через `prisma db push`, и история миграций в БД может быть неполной.
Тогда `prisma migrate deploy` в CI попытается накатить старые миграции заново и упадёт.

```bash
cd /opt/anticore
docker compose --env-file .env.deploy run --rm --no-deps server npx prisma migrate status
```

- «Database schema is up to date» или в списке только свежие миграции → всё ок.
- Если просит применить старые миграции, которые на самом деле уже в схеме, пометить каждую как применённую
  (все, **кроме** новых, которых в БД действительно нет):

  ```bash
  docker compose --env-file .env.deploy run --rm --no-deps server \
    npx prisma migrate resolve --applied 20250701084215_anticore
  # … и так для каждой старой миграции
  ```

Сделать бэкап БД перед этим: `pg_dump -Fc anticore > /root/anticore-$(date +%F).dump`.

### 5. Переключение с pm2

Выкладка теперь ручная, поэтому первую выкладку можно провести спокойно и под контролем:

1. В GitHub запустить **Run workflow** для сервера и клиента (ветка `master`, environment `none`) — дождаться зелёных проверок и сборки.
2. На сервере:

   ```bash
   cd /opt/anticore
   docker compose --env-file .env.deploy pull          # теги latest
   pm2 stop all                                        # или конкретные процессы: pm2 ls
   docker compose --env-file .env.deploy run --rm --no-deps server npx prisma migrate deploy
   docker compose --env-file .env.deploy up -d --wait
   docker compose --env-file .env.deploy ps            # оба сервиса healthy
   curl -s localhost:4444/api/health                   # {"status":"ok"}
   curl -sI localhost:3000 | head -1                   # 200
   ```

3. Проверить сайт через nginx. Всё ок → `pm2 delete all && pm2 save`, `pm2 unstartup`.
   Не ок → `docker compose --env-file .env.deploy down && pm2 start all` — старое поднимется как было
   (новые миграции только добавляют таблицы/колонки/статусы, старый код с ними работает).
4. Дальше выкладывать через Run workflow (см. «Как выкатить»).

---

## Стенд

Стенд — те же образы, но **своя** база, свои секреты и (при желании) свой сервер.

1. Папка на сервере: `/opt/anticore-stand` (`DEPLOY_PATH` в окружении `stand`), в ней те же файлы, что для прода (п. 1 выше).
2. **Порты не должны пересекаться с продом**, если стенд на том же сервере: в `server.env` стенда другой `PORT` (например `4445`),
   в `.env.deploy` стенда `CLIENT_PORT=3100`. Для nginx — отдельный `server_name` → `127.0.0.1:3100` (фронт) и `/api` → `127.0.0.1:4445`.
3. `server.env` стенда: **другая БД** (`DATABASE_URL`), другие `JWT_SECRET` / `ADMIN_*`, `FRONTEND_BASE_URL` = адрес стенда.
   Чтобы стенд не слал настоящие SMS и заявки: `SMS_RU_API_ID`, `TELEGRAM_*`, `VK_*` оставить **пустыми** (SMS пишутся в лог).
4. В окружение `stand` добавить секреты `DEPLOY_*`, а в Variables клиента — `STAND_NEXT_PUBLIC_BACKEND_API_URL` и `STAND_SITE_LINK`.
5. Run workflow → нужная ветка → `stand` (сначала сервер, потом клиент).

---

## Повседневное

| Задача | Команда (в `/opt/anticore`) |
|---|---|
| Статус | `docker compose --env-file .env.deploy ps` |
| Логи | `docker compose --env-file .env.deploy logs -f --tail 200 server` |
| Перезапуск | `docker compose --env-file .env.deploy restart server` |
| **Откат** | автоматически, если после выкладки сервис не стал healthy. Вручную: вписать прошлый тег в `SERVER_TAG=`/`CLIENT_TAG=` в `.env.deploy` → `docker compose --env-file .env.deploy up -d --wait` (тег `<sha>` — в истории Actions; у клиента стенда `<sha>-stand`). Миграции БД сами не откатываются. |
| Сиды / разовые скрипты | в образе нет `ts-node` и исходников сидов — запускать с машины разработчика против прод-БД или через отдельный образ |
| Поменять env бэка | правка `server.env` → `docker compose --env-file .env.deploy up -d server` |

## Медиа (Selectel S3)

Картинки и видео не входят ни в один образ. Раскладка бакета (`NEXT_PUBLIC_S3_URL` = публичный домен бакета):

| Ключ в бакете | Что | Откуда берётся |
|---|---|---|
| `image/blog/*`, `image/works/*` | контент блога и работ; в БД хранится ключ `blog/x.jpg` / `works/x.jpg` | сиды, админка |
| `image/site/{bg,hero,auto,carousel,techprocces,newstart}/*` | картинки вёрстки лендинга | `siteImageUrl()` в клиенте |
| `image/process/*`, `video/*` | страница `/process`, видео | уже в бакете |

Клиент строит URL в одном месте — `anticore-client/src/lib/media.ts`. Бэк файлов не отдаёт и не хранит.
Первичная загрузка — `scripts/upload-media.sh` (см. `docs/tasks/TASK_MEDIA_S3.md`). Новая картинка блога/работы:
залить в `image/blog/…` или `image/works/…` и вписать ключ (`blog/имя.jpg`) в админке.

**Порядок выкладки (один раз):** 1) залить файлы в бакет и проверить в браузере → 2) выкатить клиент → 3) выкатить сервер
(старый клиент ещё ходит за картинками на бэк, новый сервер их уже не отдаёт).

Cron-задачи (`@nestjs/schedule`) работают внутри контейнера `server` — держать **один** экземпляр.

## ЛК мастера: WebSocket и PWA (этап 5)

Уведомления приходят мастеру по WebSocket (socket.io) на путь **`/api/socket.io`** (пространство имён `/staff`).
Существующий `location /api` в nginx нужно дополнить заголовками апгрейда, иначе соединение молча
деградирует до long-polling (уведомления всё равно будут приходить, но с задержкой и лишней нагрузкой):

```nginx
location /api/socket.io/ {
    proxy_pass http://127.0.0.1:4444;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 120s;
}
```

Проверка после выкладки: в браузере у залогиненного мастера в DevTools → Network → WS виден запрос
`/api/socket.io/?EIO=4&transport=websocket` со статусом 101. Если инстансов API несколько — для socket.io нужен
sticky-режим или Redis-адаптер (сейчас инстанс один).

Клиент: `NEXT_PUBLIC_BACKEND_API_URL` должен быть абсолютным (origin берётся из него). Для установки как приложения
нужен HTTPS; файлы PWA — `public/staff.webmanifest`, `public/staff-sw.js`, `public/staff-*.png`.

## Файлы админки: фото задач (папка в публичном бакете)

Фото к задачам лежат в **том же публичном бакете**, что и картинки сайта, но в отдельной папке (`admin/` по умолчанию).
Отдельный бакет и подписанные ссылки не используются.

**Что это значит для безопасности.** Ссылка на фото — прямая и без подписи. Защита — в имени файла:
это случайный UUID (`admin/tasks/<id>/<uuid>.webp`), его нельзя угадать или перебрать. Ссылку видят только админ и исполнитель задачи,
но тот, кто её получил (скриншот, пересланное сообщение, история браузера), откроет фото без входа в систему.
Поэтому: не публикуйте ссылки, а **список файлов бакета должен быть закрыт** (см. проверку ниже). Из фото вырезаются EXIF/GPS.

1. В бакете ничего создавать не нужно: папка появится при первой загрузке. Если хотите — создайте `admin/` заранее.
2. Переменные на сервере (см. `.env.example`): уже есть `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`; **добавить `S3_PUBLIC_URL`** —
   публичный адрес бакета без слэша на конце (тот же домен, что в `NEXT_PUBLIC_S3_URL` клиента). Необязательно: `S3_FILES_PREFIX` (папка). Перезапустить API.
3. Проверка: загрузите фото к задаче в админке — оно должно показаться. Откройте ссылку на фото в режиме инкогнито: откроется (так задумано).
4. **Проверка закрытого списка:** откройте в браузере корень бакета `https://<домен бакета>/` и `https://<домен бакета>/?prefix=admin/` — должен быть отказ или пустой ответ,
   а не XML со списком файлов. Если список виден, нужно закрыть листинг в настройках контейнера Selectel, иначе UUID-защита теряет смысл.
5. Если `S3_PUBLIC_URL` не задан, загрузка фото отвечает 503 «Хранилище файлов ещё не настроено», остальное работает.

При удалении фото объект из бакета удаляется (ссылка перестаёт открываться). При каскадном удалении сотрудника задачи и фото в БД удаляются,
а объекты в бакете остаются (чистить вручную: `admin/tasks/<id задач сотрудника>/`).
