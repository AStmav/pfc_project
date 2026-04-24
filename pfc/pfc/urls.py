"""Root URL configuration for the PFC project (admin and future API includes)."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.urls import re_path
from django.views.static import serve

urlpatterns = [
    path("admin/", admin.site.urls),
    path("chat/", include("chatapp.urls")),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
if not settings.DEBUG:
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
