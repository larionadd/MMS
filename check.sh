#!/usr/bin/env bash
# Швидка перевірка після кожної зміни: синтаксис game.js + smoke-тести.
# Запуск: bash check.sh
set -e
cd "$(dirname "$0")"
echo "== Синтаксис game.js =="
node --check game.js && echo "OK"
echo "== Smoke-тести =="
node tests/smoke.test.mjs
