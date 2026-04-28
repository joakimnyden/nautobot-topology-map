from django.shortcuts import render
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import View

class TopologyDashboardView(PermissionRequiredMixin, View):
    permission_required = "nautobot_topology.view_topologylayout"
    
    def get(self, request):
        return render(request, 'nautobot_topology/dashboard.html')

class CableDiscoveryView(PermissionRequiredMixin, View):
    permission_required = "nautobot_topology.view_topologylayout"
    
    def get(self, request):
        from django.conf import settings
        plugin_config = settings.PLUGINS_CONFIG.get('nautobot_topology', {})
        context = {
            'discovery_simulator_enabled': plugin_config.get('discovery_simulator_enabled', False)
        }
        return render(request, 'nautobot_topology/discovery.html', context)
