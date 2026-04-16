# PFC — Django chat services backend

A Django-based API and real-time stack for chat-style services. The project uses **Django REST Framework** with **JWT authentication** (Simple JWT), **django-cors-headers** for browser clients, and **Django Channels** with **Redis** as the channel layer for WebSocket-style workloads. The `chatapp` package is the main application area; the API is versioned (`v1`) and uses pagination and filtering helpers from the REST framework ecosystem.

**Stack:** Django 4.2, DRF, Simple JWT, Channels, Redis (`channels_redis`), Daphne (ASGI server), SQLite for local development.

## Run Locally

### 1) Activate virtual environment

```bash
cd pfc_project
source venv/bin/activate
```

### 2) Go to Django project folder

```bash
cd pfc
```

### 3) Run database migrations

```bash
python manage.py migrate
```

### 4) Start development server (HTTP API)

```bash
python manage.py runserver
```

API base examples:
- `http://127.0.0.1:8000/admin/`
- `http://127.0.0.1:8000/chat/`

### 5) Start ASGI server with Daphne (HTTP + WebSocket)

```bash
daphne -b 0.0.0.0 -p 8000 pfc.asgi:application
```

If `daphne` is not in your PATH, run it through venv:

```bash
../venv/bin/daphne -b 0.0.0.0 -p 8000 pfc.asgi:application
```

### 6) WebSocket route example

```text
ws://127.0.0.1:8000/ws/chat/<conversation_id>/?token=<access_jwt>
```

## Frontend (React + Tailwind)

### 1) Install and start frontend

```bash
cd frontend
npm install
npm run dev
```

### 2) Optional environment config

Create `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/chat
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

### 3) Frontend scripts

```bash
npm run lint
npm run build
```

