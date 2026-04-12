"""
ASGI entrypoint for async workers, WebSockets, and Channels.

Exposes ``application`` for Daphne, Uvicorn (ASGI mode), etc.

https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from django.core.asgi import get_asgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pfc.settings')

application = get_asgi_application()
