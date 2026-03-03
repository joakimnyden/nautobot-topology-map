from django.shortcuts import render
from django.views.generic import View

class TopologyDashboardView(View):
    def get(self, request):
        return render(request, 'nautobot_topology/dashboard.html')
