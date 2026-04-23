"""
ASGI entrypoint for async workers, WebSockets, and Channels.

Exposes ``application`` for Daphne, Uvicorn (ASGI mode), etc.

https://docs.djangoproject.com/en/4.2/howto/deployment/asgi/
"""

import os

from channels.routing import ProtocolTypeRouter, URLRouter
from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "pfc.settings")

django_asgi_app = get_asgi_application()

from chatapp.routing import websocket_urlpatterns  # noqa: E402

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": URLRouter(websocket_urlpatterns),
    },
)
