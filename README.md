# Пошукач — Нова вкладка / Search — New Tab
# 🇺🇦 Українська

– завантаження

1. Скачайте або скопіюйте папку `newtab`.
2. Відкрийте браузер (Chrome / Edge) → `chrome://extensions` або `edge://extensions`.
3. Увімкніть "Режим розробника" (Developer mode).
4. Натисніть "Завантажити розпаковане розширення" (Load unpacked).
5. Виберіть папку `newtab` і підтвердіть.
6. Відкрийте нову вкладку — насолоджуйтеся.

– Команди:

- `//bg <URL>` або просто `//bg` — встановити фон (URL або файл).
- `//addicon <домен>` — додати іконку сайту.
- `//save` — примусово зберегти налаштування.
- `//clear` — очистити фон і іконки.
- `//setsearch [сервіс або URL]` — змінити пошукову систему.
- `//player <on|off>` — показати/сховати музичний плеєр.

### 🔍 Зміна пошукової системи

Ви можете змінити пошукову систему командою:
`//setsearch [сервіс]`

Підтримувані шаблони:
- **Google**: `google`, `g`, `gg`
- **DuckDuckGo**: `duckduckgo`, `ddg`, `duck`
- **Bing**: `bing`, `ms`
- **Yandex**: `yandex`, `ya`
- **Brave**: `brave`
- **Qwant**: `qwant`, `q`, `qw`

Також можна використати власний URL із підстановкою `%s`:
`//setsearch https://duckduckgo.com/?q=%s`

### 🎵 Музичний плеєр
- Інтеграція з YouTube Music.
- Керуйте відтворенням, не покидаючи вкладку.
- Детальніше див. у [player.md]([player.md](https://github.com/Foxfox09/newtab/releases/tag/1.2.022beta)).

# 🇬🇧 English

– download

1. Download or copy the `newtab` folder.
2. Open Chrome/Edge → `chrome://extensions` or `edge://extensions`.
3. Enable "Developer mode".
4. Click "Load unpacked".
5. Select the `newtab` folder and confirm.
6. Open a new tab — enjoy.

– Commands:

- `//bg <URL>` or `//bg` — set background (URL or file).
- `//addicon <domain>` — add site icon.
- `//save` — force save settings.
- `//clear` — clear background and icons.
- `//setsearch [service or URL]` — change search engine.
- `//player <on|off>` — show/hide the music player.

### 🔍 Change Search Engine

Use the command:
`//setsearch [service]`

Supported shortcuts:
- **Google**: `google`, `g`, `gg`
- **DuckDuckGo**: `duckduckgo`, `ddg`, `duck`
- **Bing**: `bing`, `ms`
- **Yandex**: `yandex`, `ya`
- **Brave**: `brave`
- **Qwant**: `qwant`, `q`, `qw`

You can also insert your own custom URL pattern using `%s`:
`//setsearch https://duckduckgo.com/?q=%s`

### 🎵 Music Player
- Integration with YouTube Music.
- Control your music without leaving the new tab.
- See [player.md]([player.md](https://github.com/Foxfox09/newtab/releases/tag/1.2.022beta)) for more details.
