#!/bin/bash

until psql -h "db" -U "postgres" -c '\l'; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 2
done

>&2 echo "Postgres is up - executing command"

npm start