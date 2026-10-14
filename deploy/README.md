# Деплой: GitHub Actions → GHCR → сервер (Docker)

Сборка идёт в GitHub. На сервере нет исходников и `node_modules` — только готовые образы
и конфиги в `/opt/anticore`.

```
push в master (anticore-server) ─► Actions: docker build ─► ghcr.io/1nspie/anticore-server:<sha>
                                   └─► ssh: pull → prisma migrate deploy → up -d server
push в master (anticore-client) ─► Actions: docker build (NEXT_PUBLIC_* из Variables) ─► ghcr.io/1nspie/anticore-client:<sha>
                                   └─► ssh: pull → up -d client
```

Контейнеры работают в `network_mode: host` на тех же портах, что раньше pm2 (API `4444`, фронт `3000`),
поэтому **nginx и Postgres не перенастраиваются**.

## Файлы

| Где | Что |
|---|---|
| `anticore-server/Dockerfile`, `anticore-client/Dockerfile` | сборка образов (Node 24) |
| `*/.github/workflows/deploy.yml` | сборка + выкладка при push в `master` (или вручную: Actions → Run workflow) |
| `deploy/docker-compose.yml` | копируется на сервер в `/opt/anticore/` |
| `deploy/.env.deploy.example` | какие теги образов запущены (CI обновляет сам) |
| `deploy/client.env.example` | runtime-переменные фронта |

---

## Первый запуск (один раз)

### 1. Сервер

```bash
# Docker + compose plugin (Ubuntu)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy        # пользователь, под которым ходит CI

sudo mkdir -p /opt/anticore/data && sudo chown -R deploy: /opt/anticore
```

Скопировать в `/opt/anticore/`:

- `docker-compose.yml` (из `deploy/`)
- `.env.deploy` (из `.env.deploy.example`)
- `server.env` — **текущий `.env` бэка с прода**. Значения буквальные: `DATABASE_URL` целиком, без `${...}`.
  Хост БД — `localhost` (работает благодаря `network_mode: host`).
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
# deploy_key (приватный) → секрет DEPLOY_SSH_KEY в GitHub (п. 4), затем удалить локально
```

### 4. GitHub (в **обоих** репозиториях)

Settings → Secrets and variables → Actions:

| Тип | Имя | Значение |
|---|---|---|
| Secret | `DEPLOY_HOST` | IP/домен сервера |
| Secret | `DEPLOY_USER` | `deploy` |
| Secret | `DEPLOY_SSH_KEY` | приватный ключ из п. 3 |
| Secret | `DEPLOY_PORT` | порт SSH, если не 22 (необязательно) |

> `DEPLOY_*` добавлять **последними** — после ручного переключения (п. 6), иначе первый же push выкатит образы, пока порты заняты pm2.

Только в **anticore-client**, вкладка **Variables** (вшиваются в JS при сборке — поменял значение → перезапусти workflow):

| Имя | Пример |
|---|---|
| `NEXT_PUBLIC_BACKEND_API_URL` | `https://xn--80aaag6amsblus.xn--p1ai/api` |
| `NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY` | `ysc1_…` |
| `NEXT_PUBLIC_S3_URL` | URL Selectel S3 |
| `NEXT_PUBLIC_REACT_APP_YMAP_KEY` | ключ Яндекс.Карт |
| `SITE_LINK` | `https://xn--80aaag6amsblus.xn--p1ai` |
| `USE_YANDEX_METRICS` | `true` |

### 5. ⚠️ Миграции Prisma на проде (проверить до первой выкладки)

Раньше схема применялась через `prisma db push`, и история миграций в БД может быть неполной.
Тогда `prisma migrate deploy` в CI попытается накатить старые миграции заново и упадёт.

```bash
cd /opt/anticore
docker compose --env-file .env.deploy run --rm --no-deps server npx prisma migrate status
```

- «Database schema is up to date» или в списке только `20260929…` → всё ок.
- Если просит применить старые миграции, которые на самом деле уже в схеме, пометить каждую как применённую
  (все, **кроме** `20260929100000_lead_processing_status` и `20260929100100_lead_sla_visit_completed`):

  ```bash
  docker compose --env-file .env.deploy run --rm --no-deps server \
    npx prisma migrate resolve --applied 20250701084215_anticore
  # … и так для каждой старой миграции
  ```

Сделать бэкап БД перед этим: `pg_dump -Fc anticore > /root/anticore-$(date +%F).dump`.

### 6. Переключение с pm2

Порядок важен: пока `DEPLOY_*`-секретов нет, шаг deploy в Actions просто падает и сервер не трогает,
а сборка образов уже работает. Так первая выкладка проходит вручную и под контролем.

1. Push в `master` обоих репозиториев (или Actions → Run workflow) — дождаться зелёного **build**
   (deploy пока красный — секретов нет, это ожидаемо).
2. На сервере (п. 1–2 и 5 уже сделаны):

   ```bash
   cd /opt/anticore
   docker compose --env-file .env.deploy pull          # теги latest
   pm2 stop all                                        # или конкретные процессы: pm2 ls
   docker compose --env-file .env.deploy run --rm --no-deps server npx prisma migrate deploy
   docker compose --env-file .env.deploy up -d
   docker compose --env-file .env.deploy ps
   curl -s localhost:4444/api/health                   # {"status":"ok"}
   curl -sI localhost:3000 | head -1                   # 200
   ```

3. Проверить сайт через nginx. Всё ок → `pm2 delete all && pm2 save`, `pm2 unstartup`.
   Не ок → `docker compose --env-file .env.deploy down && pm2 start all` — старое поднимется как было
   (миграции 29.09 только добавляют статус и колонки, старый код с ними работает).
4. Добавить `DEPLOY_*`-секреты (п. 4) → Re-run failed jobs. Дальше каждый push в `master` выкатывается сам.

---

## Повседневное

| Задача | Команда (в `/opt/anticore`) |
|---|---|
| Статус | `docker compose --env-file .env.deploy ps` |
| Логи | `docker compose --env-file .env.deploy logs -f --tail 200 server` |
| Перезапуск | `docker compose --env-file .env.deploy restart server` |
| **Откат** | вписать прошлый sha в `SERVER_TAG=`/`CLIENT_TAG=` в `.env.deploy` → `docker compose --env-file .env.deploy up -d` (sha — в истории Actions). Миграции БД сами не откатываются. |
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
