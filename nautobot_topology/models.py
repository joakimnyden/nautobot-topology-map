from django.db import models
from nautobot.core.models.generics import PrimaryModel
from nautobot.dcim.models import Location

class TopologyLayout(PrimaryModel):
    site = models.OneToOneField(
        to=Location,
        on_delete=models.CASCADE,
        related_name='topology_layout'
    )
    layout_data = models.JSONField(default=dict)

    class Meta:
        verbose_name = "Topology Layout"
        verbose_name_plural = "Topology Layouts"

    def __str__(self):
        return f"Layout for {self.site.name}"
