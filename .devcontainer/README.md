
# MedOrbits / GHAR — Development Containers

## Purpose

Provide a reproducible development environment using Docker,
Docker Compose, VS Code Dev Containers and GitHub Codespaces.

## Requirements

- Docker Desktop or compatible Docker Engine
- Docker Compose v2
- Visual Studio Code
- Dev Containers extension
- Git

## Getting Started

1. Open the repository in VS Code.
2. Install the Dev Containers extension.
3. Open the Command Palette.
4. Select Dev Containers: Reopen in Container.
5. Wait for initialization.
6. Open the integrated terminal.

## Services

| Service | Port | Purpose |
|—|—:|—|
| Application | 3000 | Backend |
| Secondary API | 3001 | Additional service |
| Frontend | 5173 | Frontend development |
| PostgreSQL | 5432 | Development database |
| Node Inspector | 9229 | Debugging |

## Runtime

- Node.js 22
- Python 3
- PostgreSQL 16
- npm
- Git
- PostgreSQL client

## Initialization

The post-create script:

- Checks Node.js and Python.
- Installs npm dependencies when a lockfile exists.
- Creates a Python virtual environment when Python dependencies exist.
- Preserves local environment files.
- Does not execute database migrations.

## Database

Development database:

- Database: medorbits_dev
- Username: medorbits
- Host: postgres
- Port: 5432

Use development-only credentials.

## Security

- Never copy production credentials into the container.
- Never commit .env files.
- Do not expose private uploaded documents.
- Do not mount production databases.
- Review Docker images and dependencies.
- Keep secrets outside the repository.

## Persistent Storage

Docker named volumes preserve:

- npm dependencies
- Python virtual environment
- PostgreSQL development data

## Troubleshooting

Rebuild the container if its Dockerfile changes.

Use:

Dev Containers: Rebuild Container

Inspect services with:

docker compose ps

Inspect logs with:

docker compose logs app
docker compose logs postgres

## Important

This environment is for local development only.

Production deployment, database migrations and destructive
operations require separate explicit approval.
