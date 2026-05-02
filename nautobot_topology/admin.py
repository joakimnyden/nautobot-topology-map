from django.contrib import admin
from nautobot.apps.admin import NautobotModelAdmin
from .models import TopologyLayout


@admin.register(TopologyLayout)
class TopologyLayoutAdmin(NautobotModelAdmin):
    list_display = ("site", "last_updated")
    search_fields = ("site__name",)
