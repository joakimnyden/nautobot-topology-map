from django.shortcuts import render
from django.contrib.auth.mixins import PermissionRequiredMixin
from django.views.generic import View

class TopologyDashboardView(PermissionRequiredMixin, View):
    permission_required = "nautobot_topology.view_topologylayout"
    
    def get(self, request):
        return render(request, 'nautobot_topology/dashboard.html')
