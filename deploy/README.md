# Деплой: GitHub Actions → GHCR → сервер (Docker)

Сборка идёт в GitHub. На сервере нет исходников и `node_modules` — только готовые образы
и конфиги в `/opt/anticore`.

```
push в master (оба репо) ─► проверки (tsc, тесты) ─► сборка образа ─► ghcr.io/1nspie/anticore-{server,client}:<sha>  (+ latest)
                            └─ само на сервер НЕ выкатывается (если не включён AUTO_DEPLOY_PRODUCTION)

Run workflow (ветка + production) ─► то же самое ─► ssh: docker login → pull → [prisma migrate deploy] → up -d --wait
                                                    └─ не стал healthy → автоматический откат на прошлый образ
```

Контейнеры работают в `network_mode: host` на тех же портах, что раньше pm2 (API — `4444`, фронт — `3000`),
поэтому **nginx и Postgres не перенастраиваются**. База остаётся прежней (`DATABASE_URL` из текущего `.env`) — данные копировать не нужно.

---

## Первый запуск на проде (по порядку)

> Пока старый сайт работает на pm2, его ничего не затрагивает до шага 6: простой — секунды, при сбое pm2 возвращается сам.

**1. Смержить PR** с Docker-файлами в обоих репозиториях (запускать workflow вручную можно только когда файл попал в `master`).

**2. Секреты и переменные GitHub** (у себя, в терминале; нужен `gh auth login`):

```bash
./scripts/setup-github-deploy.sh      # спросит адрес сервера, пользователя (deploy), порт, папку; занесёт DEPLOY_* в окружение production обоих репо
```

Variables клиента (только репозиторий `anticore-client`, Settings → Secrets and variables → Actions → **Variables**) —
вшиваются в JS при сборке:

| Имя | Пример |
|---|---|
| `NEXT_PUBLIC_BACKEND_API_URL` | `https://xn--80aaag6amsblus.xn--p1ai/api` |
| `SITE_LINK` | `https://xn--80aaag6amsblus.xn--p1ai` |
| `NEXT_PUBLIC_S3_URL` | публичный домен бакета Selectel |
| `NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY` | `ysc1_…` |
| `NEXT_PUBLIC_REACT_APP_YMAP_KEY` | ключ Яндекс.Карт |
| `USE_YANDEX_METRICS` | `true` |

**3. Подготовить сервер** (один раз). Скопировать скрипты с компьютера и выполнить на сервере:

```bash
scp bootstrap-server.sh cutover.sh valentin@87.228.97.171:~
ssh valentin@87.228.97.171
sudo bash bootstrap-server.sh /путь/к/текущему/anticore-server/.env
```

Скрипт ставит Docker, создаёт пользователя `deploy` для CI (с ключом GitHub Actions), папку `/opt/anticore`,
`docker-compose.yml` и `server.env`, собранный из текущего `.env` бэка (кавычки сняты, `DATABASE_URL` раскрыт). Значения секретов не печатает.
pm2, nginx и сайт не трогает.

**4. Скачать образы на сервер.** GitHub → Actions → «Build & deploy server» → **Run workflow**: ветка `master`,
environment `production`, **pull_only = true**. Затем то же для «Build & deploy client». Сервер сам залогинится в GHCR одноразовым токеном задания,
отдельный токен не нужен. Перезапуска при `pull_only` нет.

**5. ⚠️ Миграции Prisma** — `cutover.sh` сам покажет `prisma migrate status` и спросит подтверждение.
Раньше схема применялась через `prisma db push`, история миграций в БД может быть неполной. Если статус просит накатить старые миграции,
которые уже есть в схеме, — пометить их применёнными и только потом продолжать:

```bash
cd /opt/anticore
docker compose --env-file .env.deploy run --rm --no-deps server \
  npx prisma migrate resolve --applied 20250701084215_anticore
# … и так для каждой старой миграции (кроме тех, которых в БД действительно нет)
```

**6. Переключение.** Выйти из ssh и зайти заново (чтобы заработала группа `docker`), затем:

```bash
bash cutover.sh
```

Скрипт: дамп базы (`~/anticore-before-docker-….dump`) → статус и применение миграций → остановка pm2 (спросит имена процессов) →
`up -d --wait` → проверка. Не поднялось — вернёт pm2 само. Всё хорошо → `pm2 delete <имена> && pm2 save`.

**7. Закрыть лишние порты** (см. «Безопасность сервера» ниже) и дальше выкатывать через Run workflow.

---

## Как выкатывать дальше

1. GitHub → репозиторий → **Actions** → «Build & deploy server» (или «…client») → **Run workflow**.
2. **Use workflow from** — нужная ветка. **environment**: `production` — выкатить, `none` — только собрать образ.
3. Порядок: **сначала сервер, потом клиент** (клиент зависит от новых эндпоинтов и миграций).

Перед сборкой всегда идут проверки: `tsc` (оба репо) и тесты (сервер). Красные — образ не собирается и не выкатывается.

- **Автовыкладка при push в master** выключена. Включить: Settings → Secrets and variables → Actions → **Variables** → `AUTO_DEPLOY_PRODUCTION = true`.
- **Подтверждение перед прод-выкладкой:** Settings → Environments → production → Required reviewers.
- **Теги образов:** `<sha>` — всегда; `latest` — только сборки из `master`.
- **Миграции** выполняются автоматически перед перезапуском бэка (`prisma migrate deploy`). Откат образа миграции **не откатывает**.
- Не стал healthy → CI сам возвращает прошлый образ и помечает задание красным.

## Файлы

| Где | Что |
|---|---|
| `anticore-server/Dockerfile`, `anticore-client/Dockerfile` | сборка образов (Node 24) |
| `*/.github/workflows/deploy.yml` | проверки → сборка → (по выбору) выкладка |
| `deploy/docker-compose.yml` | на сервере в `/opt/anticore/`; healthcheck обоих сервисов |
| `deploy/bootstrap-server.sh` | разовая подготовка сервера (Docker, пользователь `deploy`, папка, env-файлы) |
| `deploy/cutover.sh` | переключение с pm2: дамп БД, миграции, запуск, откат при сбое |
| `deploy/.env.deploy.example` | какие теги образов запущены (CI обновляет сам) и `CLIENT_PORT` |
| `deploy/server.env.example` | **все** переменные бэка с пояснениями: что обязательно, что нет |
| `deploy/client.env.example` | runtime-переменные фронта |

---

## Безопасность сервера: закрыть порты наружу

Проверка снаружи (20.10) показала, что на IP сервера **открыты 5432 (Postgres), 3000 и 4444**. Наружу нужны только 22, 80 и 443:
фронт и API должны быть доступны только через nginx, база — только с самого сервера.

- **Postgres** — не слушать внешний интерфейс: в `postgresql.conf` `listen_addresses = 'localhost'`, перезапуск `sudo systemctl restart postgresql`.
  Контейнеры работают в `network_mode: host`, поэтому `localhost` им доступен.
- **3000 и 4444** — закрыть файрволом (`ufw`) или у провайдера, оставив 22/80/443. **Осторожно:** перед `ufw enable` обязательно разрешить SSH
  (`sudo ufw allow OpenSSH`), иначе потеряешь доступ к серверу.
- Проверка: с другого компьютера `nc -zv 87.228.97.171 5432` должен не подключаться.

---

## Стенд (необязательно)

Сейчас стенда нет, всё идёт сразу в прод. Если понадобится: workflow умеет `stand` (свои секреты в окружении `stand`,
образ клиента `<sha>-stand` собирается из переменных `STAND_*`; `STAND_NEXT_PUBLIC_BACKEND_API_URL` и `STAND_SITE_LINK` обязательны),
на сервере — отдельная папка (`DEPLOY_PATH`), другие порты (`PORT` в `server.env`, `CLIENT_PORT` в `.env.deploy`) и **своя база**.
Окружения `stand` в GitHub сейчас нет — создать при необходимости.

---

## Бэкап базы

Ночной `pg_dump` в `/var/backups/anticore` (доступ только у root), формат custom, имя `anticore-ГГГГ-ММ-ДД_ЧЧММ.dump`.
Перед сохранением архив проверяется (`pg_restore --list`), хранятся копии за 14 дней, но не меньше 5 последних.

**Установка (один раз):**

```bash
scp backup-db.sh install-backup.sh restore-check.sh valentin@87.228.97.171:~
ssh valentin@87.228.97.171
sudo bash install-backup.sh
```

Скрипт ставит `postgresql-client` (если нет), кладёт `/usr/local/bin/anticore-backup`, вешает cron на **03:30** (время сервера) и сразу делает первую копию.

| Задача | Команда |
|---|---|
| Сделать копию сейчас | `sudo anticore-backup` |
| Посмотреть копии | `sudo ls -lh /var/backups/anticore` |
| Лог | `tail /var/log/anticore-backup.log` |
| **Проверить, что копия восстанавливается** (раз в месяц) | `sudo anticore-restore-check` — разворачивает последнюю копию во временную базу `anticore_restore_check`, считает строки, удаляет её. Боевая база не затрагивается. |

**Восстановление боевой базы** (только в крайнем случае, предварительно остановив бэк, чтобы он не писал в базу во время восстановления):

```bash
cd /opt/anticore
docker compose --env-file .env.deploy stop server
sudo -u postgres pg_restore --clean --if-exists --no-owner --dbname=anticore < /var/backups/anticore/anticore-ДАТА.dump
docker compose --env-file .env.deploy up -d --wait server
```

**Мониторинг (необязательно).** Если задать `PING_URL` (например, адрес проверки на healthchecks.io), скрипт дёргает его после успешной копии
и `…/fail` при ошибке — придёт уведомление, если бэкап перестал выполняться. Чтобы включить: в `/etc/cron.d/anticore-backup` добавить перед командой `PING_URL=https://hc-ping.com/<uuid>`.

> ⚠️ **Это защита от ошибок и порчи данных, но не от потери сервера:** копии лежат на том же диске.
> Нужна копия вне сервера — в **отдельное закрытое хранилище**. Бакет с картинками сайта **публичный**, дампы туда класть нельзя.

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

## nginx: что нужно для кабинета мастера

Кабинет мастера живёт внутри админки (`/admin/master/*`) и использует тот же фронт и тот же API, но ему нужны четыре вещи в nginx.
Конфиг nginx лежит на сервере, вне репозитория: ниже — **что добавить** в существующие `server`/`location /api`, а не готовый файл.

> **Статус боевого nginx на 87.228.97.171 (проверено 31.10.2026, `/etc/nginx/sites-available/default`): менять ничего не нужно.** Уже есть `client_max_body_size 20M`, в `location /api/` — заголовки `Upgrade`/`Connection` (WebSocket по `/api/socket.io/` идёт через него), `X-Forwarded-For`/`-Proto`/`X-Real-IP`, `proxy_read_timeout 120s`, HTTPS; CSP нет. Отдельный `location /api/socket.io/` не нужен. Пункты ниже — справочные: для нового сервера или если конфиг будут переписывать.

**1. Размер загрузок.** Фото задач (до 15 МБ) и PDF регламента (до 10 МБ) идут через API. nginx по умолчанию режет тело запроса до 1 МБ
(ответ **413**), поэтому в `location /api/` (или `server`) нужно:

```nginx
client_max_body_size 20m;
```

**2. WebSocket.** Уведомления приходят по socket.io на путь **`/api/socket.io`** (пространство имён `/staff`). Без заголовков апгрейда
соединение молча деградирует до long-polling (уведомления идут, но с задержкой и лишней нагрузкой). Отдельный блок, **рядом** с `location /api/`:

```nginx
location /api/socket.io/ {
    proxy_pass http://127.0.0.1:4444;          # без URI в конце — путь передаётся как есть
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 120s;                   # socket.io шлёт ping раз в ~25 с
}
```

Если в конфиге есть regex-локации (`location ~ ...`), проверьте, что они не перехватывают `/api/socket.io/`: regex выигрывает у префикса.

**3. Реальный IP клиента.** API работает с `trust proxy` и считает лимиты запросов и блокировку перебора по IP. В **каждом** `location`,
который проксирует на API (`/api/`, `/api/socket.io/`), должны быть заголовки `X-Forwarded-For` и `X-Forwarded-Proto` (см. блок выше).
Иначе все мастера и админы будут выглядеть одним IP (адресом nginx) и делить общий лимит запросов.

**4. HTTPS и кэш service worker.**
- HTTPS обязателен: геолокация для чекина и установка PWA работают **только** в защищённом контексте (на `http://` браузер не даст определить местоположение).
- Файлы PWA (`/staff-sw.js`, `/staff.webmanifest`) раздаёт Next. Если в nginx есть общее правило долгого кэша для статики
  (`location ~* \.(js|json|webmanifest|png)$ { expires 30d; }`), **исключите** из него `/staff-sw.js` и `/staff.webmanifest`:
  иначе обновления service worker не доедут до телефонов мастеров.
- Если настроен `Content-Security-Policy`, разрешите: `connect-src wss://<домен>` (WebSocket) и `img-src https://<домен бакета Selectel>` (фото задач).

После правок:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

**Проверка после выкладки** (`--http1.1` обязателен: по умолчанию curl идёт по HTTP/2, где «Upgrade» не существует; браузеры для WebSocket сами выбирают HTTP/1.1)
- WebSocket: `curl --http1.1 -si -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: x3JJHMbDL1EzLkh9GBhXDw==" "https://<домен>/api/socket.io/?EIO=4&transport=websocket" | head -1` должен ответить `HTTP/1.1 101 Switching Protocols`
  (в браузере: DevTools → Network → WS, у залогиненного мастера запрос со статусом 101).
- Загрузка: фото 5–10 МБ к задаче прикрепляется без ошибки 413.
- IP: в журнале входов (`/admin/staff` → «Журнал входов») виден реальный адрес мастера, а не `127.0.0.1`.

Если инстансов API несколько — для socket.io нужен sticky-режим или Redis-адаптер (сейчас инстанс один, cron-задачи тоже рассчитаны на один).

Клиент: `NEXT_PUBLIC_BACKEND_API_URL` должен быть абсолютным (origin для WebSocket берётся из него). Файлы PWA — `public/staff.webmanifest`
(`start_url`/`scope` = `/admin/master`), `public/staff-sw.js`, `public/staff-*.png`.

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

## Единый вход (админ и мастер)

Вход один — страница `/admin` (форма логин + пароль). Роль определяется на сервере: администратор попадает в админку (`/admin/calendar`),
мастер — в свой кабинет (`/admin/master`). Отдельной страницы входа для мастеров нет; старые адреса `/staff/*` перенаправляются на `/admin/master/*`.

- Для PWA на телефонах мастеров изменились `start_url` и `scope` (`/admin/master`): уже установленное приложение лучше переустановить («Добавить на главный экран» заново).
- Сотрудники с ролью «Администратор» (создаются в «Сотрудники») входят в админку так же, как админ из `.env`; блокировка такой учётки отключает доступ немедленно.
- Сам единый вход ничего нового в nginx не требует (`/admin/*` — тот же фронт, `/api/*` — тот же API); требования кабинета мастера (WebSocket, размер загрузок, реальный IP, HTTPS) — в разделе «nginx» выше.
