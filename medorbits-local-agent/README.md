# MedOrbits Local Agent

A local-first Node.js dashboard for asking Ollama to propose repository changes and reviewing those changes before application.

## Location

Place this folder at:

`medorbits-global/medorbits-local-agent/`

The default repository root is the parent folder, `medorbits-global/`. The agent does not create a nested Git repository.

## Requirements

- Node.js 20 or newer
- Ollama installed and running locally
- A model available in Ollama, default `qwen2.5-coder:3b`

Check Ollama in your terminal:

```bash
ollama list
ollama pull qwen2.5-coder:3b
```

## Run

```bash
cd medorbits-local-agent
cp .env.example .env
npm start
```

Open `http://127.0.0.1:4173`.

On Windows, create `.env` by copying `.env.example` in your file manager or terminal.

## Read-only by default

`AGENT_ALLOW_FILE_WRITES=false` is the default. The dashboard can create proposals, but application is refused until you deliberately enable writes. Do not enable writes until you have a separate backup and have reviewed the path restrictions.

To enable the apply route locally, set both:

```dotenv
AGENT_ALLOW_FILE_WRITES=true
AGENT_APPROVAL_TOKEN=replace-with-a-long-random-secret
```

Use a long random token only in your untracked `.env`. The UI sends the token when applying. Never expose this server to other devices or the public internet.

## Safety notes

- The agent never runs generated shell commands.
- It only considers text files with allowed extensions.
- It excludes hidden directories, dependency folders, credentials, environment files, and lockfiles from scanning.
- It limits context size, request size, proposal count, file size, and proposal lifetime.
- Before applying, it rechecks the target path and original file contents.
- Recovery copies are stored under `.medorbits-agent-backups/`; retain them until you verify the result.
- Filesystem race conditions cannot be eliminated completely in a small local server. Keep the server loopback-only and back up the repository first.
- The model’s suggested tests are not executed automatically.

## API

- `GET /api/status`
- `GET /api/proposals`
- `POST /api/propose` with `{“request”:”...”}`
- `POST /api/reject` with `{“id”:”...”}`
- `POST /api/approve` with `{“id”:”...”,”confirm”:”APPROVE FILE CHANGES”,”approvalToken”:”...”}`

## Verify syntax

```bash
npm run check:all
```

The project uses only Node.js built-ins; there are no runtime npm dependencies.
