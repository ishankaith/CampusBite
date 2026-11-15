# CampusBite Docker setup

## Before starting

1. Install and start Docker Desktop.
2. Make sure your existing `backend/campusbite.db` database is present.
3. Keep your existing `backend/.env` file. Do not replace its `SECRET_KEY` or Gemini key.
4. If you do not have `backend/.env`, copy `backend/.env.example` to `backend/.env`, then set a strong `SECRET_KEY` and your Gemini key.

## Build and start

From the CampusBite project root (the folder containing `docker-compose.yml`), run:

```bash
docker compose up --build
```

Open the frontend at:

- http://localhost:8080

Backend checks:

- http://localhost:8000/health
- http://localhost:8000/docs

## Stop

Press `Ctrl+C`, then run:

```bash
docker compose down
```

This does not delete your host database.

## Important database note

The backend service mounts `./backend/campusbite.db` into the container at `/app/campusbite.db`. The existing SQLite database remains on your computer and is used by the container. Do not delete or rename this file.

## Troubleshooting

View logs:

```bash
docker compose logs -f backend
docker compose logs -f frontend
```

Rebuild after changing source or configuration:

```bash
docker compose down
docker compose up --build
```

Do not use `docker compose down -v` for this setup.

## GitHub and secrets

Do not commit `backend/.env`, database files, database backups, `.venv`, `node_modules`, or `.git`. Commit `backend/.env.example` instead. The root `.dockerignore` excludes secrets, local databases and development folders from Docker build context.
