from django.urls import reverse
from nautobot.apps.ui import TemplateExtension

class SiteTopologyTab(TemplateExtension):
    model = "dcim.location"

    def detail_tabs(self):
        obj = self.context.get("object")
        if obj:
            return [
                {
                    "title": "Topology",
                    "url": reverse("plugins:nautobot_topology:dashboard") + f"?site={obj.id}",
                },
                {
                    "title": "Cable Discovery",
                    "url": reverse("plugins:nautobot_topology:discovery") + f"?site={obj.id}",
                },
            ]
        return []

template_extensions = [SiteTopologyTab]
