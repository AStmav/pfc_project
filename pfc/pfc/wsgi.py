"""
WSGI entrypoint for synchronous HTTP deployment.

Exposes ``application`` for Gunicorn/uWSGI and similar servers.

https://docs.djangoproject.com/en/4.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'pfc.settings')

application = get_wsgi_application()
