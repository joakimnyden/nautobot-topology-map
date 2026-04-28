import os
import time
from django.shortcuts import render
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import View
from django.templatetags.static import static


def _build_version():
    """Return mtime of index.js as a cache-buster string."""
    try:
        from django.conf import settings
        js_path = os.path.join(settings.STATIC_ROOT, 'nautobot_topology', 'assets', 'index.js')
        return str(int(os.path.getmtime(js_path)))
    except Exception:
        return str(int(time.time()))


class TopologyDashboardView(PermissionRequiredMixin, View):
    permission_required = "nautobot_topology.view_topologylayout"

    def get(self, request):
        return render(request, 'nautobot_topology/dashboard.html', {
            'timestamp': _build_version(),
        })


class CableDiscoveryView(PermissionRequiredMixin, View):
    permission_required = "nautobot_topology.view_topologylayout"

    def get(self, request):
        from django.conf import settings
        plugin_config = settings.PLUGINS_CONFIG.get('nautobot_topology', {})
        context = {
            'discovery_simulator_enabled': plugin_config.get('discovery_simulator_enabled', False),
            'timestamp': _build_version(),
        }
        return render(request, 'nautobot_topology/discovery.html', context)
