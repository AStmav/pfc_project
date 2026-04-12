"""Root URL configuration for the PFC project (admin and future API includes)."""

from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
]
