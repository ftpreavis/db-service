#!/bin/sh

chown -R app:app /app/database

exec runuser -u app -- "$@"
