# Тесты навигации (Playwright, без сети)

GitHub подменён (`mock.js`): данные читаются из локального клона репозитория данных, запись — в память, в репозиторий ничего не уходит.

    cd journal-app && python3 -m http.server 8765 --bind 127.0.0.1 &
    cd tests && ln -sf /usr/lib/node_modules node_modules
    DATA=/home/claude/journal-data TOKENS=1 node nav.js        # вкладки, «Назад» телефона, меню, чат, метка токенов
    DATA=/home/claude/journal-data node nav2.js                # после «Сохранить» — назад на предыдущий экран
    node first.js                                              # пустой репозиторий друга: подключение и первое сообщение
    DATA=<данные с pages.json> PAGES=1 OWNER=x node nav.js     # свои разделы
    DATA=/home/claude/journal-data node crawl.js               # прокликать все кнопки вкладок и меню (~20 мин)

Перед выпуском заметной правки навигации — прогнать nav.js и nav2.js.
