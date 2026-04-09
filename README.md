# PFC — Django chat services backend

A Django-based API and real-time stack for chat-style services. The project uses **Django REST Framework** with **JWT authentication** (Simple JWT), **django-cors-headers** for browser clients, and **Django Channels** with **Redis** as the channel layer for WebSocket-style workloads. The `chatapp` package is the main application area; the API is versioned (`v1`) and uses pagination and filtering helpers from the REST framework ecosystem.

**Stack:** Django 4.2, DRF, Simple JWT, Channels, Redis (`channels_redis`), Daphne (ASGI server), SQLite for local development.


