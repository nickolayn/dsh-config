# dsh-config

Персональная конфигурация DeepSeek Harness: профиль `desktop`, мои плагины и скиллы.
Нужна, чтобы одна и та же настройка работала на домашнем и на рабочем компьютере.

## Что здесь хранится

| Путь | Что это |
|---|---|
| `profile/package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` | список бандлов и зафиксированные версии плагинов |
| `profile/cordis.patch.yml` | мои настройки поверх бандлов (модели, локаль, права, GigaChat) |
| `profile/cordis.yml` | пустой корень профиля (так задумано в DSH, правится не он) |
| `profile/plugins/` | локальные плагины, которые я правлю сам (`dsh-locale-ru`) |
| `profile/created-plugins/` | плагины, созданные через приложение |
| `skills/` | пользовательские скиллы (`legal-ru`) |
| `DSH_VERSION` | версия DSH, с которой снят снимок |
| `sync.ps1` | скрипт синхронизации |

Чего здесь нет и не должно быть: `node_modules` (ставится из lock-файла), `sessions/`, `attachments/`,
`.credentials.yaml` (ключи API), кэши `.dsh-market` и `.plugin-manager`.

## Быстрый старт на новой машине

```powershell
# 1. Поставить DeepSeek Harness той же версии, что в DSH_VERSION, и git
# 2. Один раз запустить DeepSeek Harness — он создаст профиль в %USERPROFILE%\.dsh\profiles\desktop
# 3. Авторизовать GitHub (репозиторий приватный), см. раздел «Если git не авторизован»
# 4. Склонировать репозиторий в любое место
git clone https://github.com/nickolayn/dsh-config.git "$env:USERPROFILE\dsh-config"
# 5. Разложить конфигурацию и поставить зависимости
cd "$env:USERPROFILE\dsh-config"
.\sync.ps1 pull
# 6. Перезапустить приложение, затем ввести ключи API в Settings -> Providers (они не хранятся в git)
```

Порядок важен: `pull` раскладывает файлы в существующий профиль, поэтому приложение должно быть
запущено хотя бы раз до него — иначе скрипт остановится с подсказкой.

## Одна команда на новой машине

Если `bootstrap.ps1` уже лежит на компьютере (скопирован, получен из ZIP или из другого репозитория):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1
```

Скрипт делает всё сам: проверяет git и авторизацию GitHub, клонирует или обновляет репозиторий в
`%USERPROFILE%\dsh-config`, проверяет установку DeepSeek Harness, при необходимости создаёт профиль,
раскладывает конфигурацию и ставит зависимости. Не автоматизируется только вход в GitHub в окне браузера —
это единственный шаг, который делает человек.

Полезные ключи: `-CreateProfile` (сам запустит приложение, чтобы профиль создался, и закроет его),
`-Target <путь>`, `-NoInstall`, `-ProfileName <имя>`.

## Проверка установки

```powershell
.\verify.ps1              # локальная проверка: репозиторий, CLI, версия, файлы профиля, зависимости, скилл
.\verify.ps1 -Publish     # то же + отчёт в verify/last.json и отправка на GitHub
```

Отчёт содержит имя машины, версию DSH, состояние файлов профиля и зависимостей — поэтому состояние
любой машины можно проверить из репозитория, не имея к ней прямого доступа. Код возврата 1, если есть
проблемы (🔴 fail), 0 — если только предупреждения.

## Мост для плагинов (CRM отеля, TeamJet)

Страницы плагинов работают в браузере DSH, поэтому читать чужие API им мешает CORS,
а токены (TeamJet) нельзя держать в браузерном коде. Мост — единственное место с сетью и секретами:

```powershell
cd "$env:USERPROFILE\dsh-config"
.\bridge\start.cmd          # или: node bridge\bridge.mjs
```

Слушает только `127.0.0.1:8878`, зависимостей нет. Настройки — `bridge/bridge.config.json`
(создаётся при первом запуске, в git не попадает): адрес CRM, `userId` для записи,
адрес и токен TeamJet.

| Маршрут | Что делает |
|---|---|
| `GET /health` | самопроверка и текущие настройки |
| `GET /crm/state` | прокси на `{crm}/api/state` — 100 заявок, SLA считает CRM |
| `GET /crm/task/:id` | одна заявка |
| `POST /crm/tasks`, `POST /crm/tasks/:id/status` | запись (нужен `crm.userId` в настройках) |
| `GET /teamjet/health` | кто я в TeamJet (проверка входа) |
| `GET /teamjet/tasks` | заявки TeamJet: `?status=1,2,4,6&limit=50&offset=0` |
| `GET /teamjet/summary` | счётчики по статусам (кеш 1 мин) |
| `GET /teamjet/users` | справочник сотрудников: id → имя |

### Вход в TeamJet

TeamJet авторизует через Keycloak, публичного API-ключа нет, поэтому мост логинится сам:

| Шаг | Запрос |
|---|---|
| вход | `POST /api/keycloak/login` с `{login, password, hotelkey}` |
| обновление | `POST /api/keycloak/refresh` с `refresh_token` |
| заявки | `POST /api/tasks/v2/list` + `Authorization: Bearer …` (не больше 50 за страницу) |

Логин, пароль и `hotelkey` лежат **только** в `bridge/bridge.config.json` на этом компьютере
(файл в `.gitignore`, в браузер не попадает). Пароль там в открытом виде — это цена локального
моста; для рабочей машины лучше отдельный сервисный аккаунт TeamJet.


## Если PowerShell запрещает скрипты

Корпоративная политика может блокировать запуск `.ps1` — ошибка `PSSecurityException: выполнение сценариев
отключено в этой системе`. Способы, от простого к надёжному:

```powershell
# 1) разрешить локальные и скачанные скрипты для текущего пользователя (администратор не нужен)
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned -Force
.\bootstrap.ps1 -CreateProfile

# 2) разовый обход только для этого запуска
powershell -NoProfile -ExecutionPolicy Bypass -File .\bootstrap.ps1 -CreateProfile

# 3) когда политику задаёт групповая (GPO) и переопределить её нельзя — запуск без загрузки .ps1
run.cmd setup      # развернуть конфигурацию и создать профиль
run.cmd pull       # синхронизация с репозиторием
run.cmd verify     # проверка установки
```

`run.cmd` В PowerShell файлы текущего каталога вызываются только с префиксом `.\` или через `cmd /c run.cmd setup`.

читает скрипт как текст и выполняет его в памяти, поэтому запрет на выполнение файлов-сценариев
ему не мешает. Все остальные команды из этого README остаются в силе.

## Если git не авторизован

Для приватного репозитория без авторизации GitHub отвечает `remote: Repository not found` — это не
опечатка в адресе. Варианты, от лучшего к простому:

```powershell
# Вариант A: gh CLI (если установлен)
gh auth login

# Вариант B: Git Credential Manager — после этого clone откроет окно входа в браузере
git config --global credential.helper manager
git clone https://github.com/nickolayn/dsh-config.git "$env:USERPROFILE\dsh-config"

# Вариант C: без git вообще — скачать ZIP в браузере (вы уже вошли в GitHub)
#   https://github.com/nickolayn/dsh-config/archive/refs/heads/main.zip
#   распаковать в %USERPROFILE%\dsh-config, затем: cd "$env:USERPROFILE\dsh-config"; .\sync.ps1 pull
#   Когда появится авторизация — привязать git к этой папке:
#   git init; git remote add origin https://github.com/nickolayn/dsh-config.git; git fetch; git reset --hard origin/main
```

Если в браузере вход уже есть, а git всё равно отказывает, значит в Credential Manager лежит токен
другого аккаунта: `cmdkey /delete:git:https://github.com`, затем повторить clone.

## Ежедневное использование

```powershell
.\sync.ps1 status            # что расходится между компьютером и репозиторием
.\sync.ps1 push              # компьютер -> репозиторий (коммит + отправка на GitHub)
.\sync.ps1 push -Message "новый провайдер"
.\sync.ps1 pull              # репозиторий -> компьютер (+ dsh plugin install)
.\sync.ps1 pull -NoInstall   # только файлы, без установки зависимостей
.\sync.ps1 push -NoPush      # закоммитить локально, не отправлять
```

`pull` перед перезаписью делает резервные копии `package.json` и `cordis.patch.yml` рядом с оригиналами
(`*.bak-<дата>`), файлы плагинов только добавляет и перезаписывает, но не удаляет.

## Особенности, о которых надо помнить

- **Версия DSH должна совпадать** на обеих машинах (сейчас смотри `DSH_VERSION`). При разных версиях
  плагины с требованиями `engines.dsh` могут не установиться; `pull` об этом предупредит.
- **`dsh-locale-ru`** — не только перевод интерфейса: он ещё патчит оболочку Desktop
  (`tools/patch-shell.mjs`). Патч привязан к версии приложения, поэтому после установки Desktop на новой
  машине прогони его установщик; если shell-патч не применился, смотри `plugins/dsh-locale-ru/shell-patch.log`.
- **GigaChat** в `cordis.patch.yml` указывает на локальный шлюз `http://127.0.0.1:8877/v1`. На каждой машине
  нужен свой запущенный шлюз, иначе провайдер не отвечает.
- **Ключи API** живут в `%USERPROFILE%\.dsh\.credentials.yaml` и не версионируются — вводятся на каждой машине.
- **История сессий** не синхронизируется: каталог сессий кодирует путь воркспейса, на другой машине он иной.
  Нужен диалог — экспортируй его или сохрани итог в файлы проекта.
- **Рабочие файлы** проектов лежат не здесь, а в OneDrive и синхронизируются OneDrive.
- **Имя пользователя Windows может отличаться** (`nicko` дома, `Николай` на работе) — в скрипте нет
  зашитых путей: профиль берётся из `$env:USERPROFILE`, а абсолютные `link:` на локальный плагин
  скрипт пересчитывает под ту машину, где выполняется `pull`. Кириллица в пути поддерживается.
- **CLI `dsh`** скрипт ищет сам: сначала в `PATH`, затем в `%LOCALAPPDATA%\Programs\DeepSeek Harness\resources\runtime\cli\bin`.
  Если не нашёл — скажет, что включить в меню приложения (Manage dsh Command).
