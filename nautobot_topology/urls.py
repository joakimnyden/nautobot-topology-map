from django.urls import path, include
from .views import TopologyDashboardView, CableDiscoveryView

urlpatterns = [
    path("dashboard/", TopologyDashboardView.as_view(), name="dashboard"),
    path("discovery/", CableDiscoveryView.as_view(), name="discovery"),
    path("api/", include("nautobot_topology.api.urls")),
]
