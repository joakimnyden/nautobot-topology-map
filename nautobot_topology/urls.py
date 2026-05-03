from django.urls import path, include
from .views import TopologyDashboardView, CableDiscoveryView

urlpatterns = [
    path("dashboard/", TopologyDashboardView.as_view(), name="dashboard"),
    path("topology/<uuid:pk>/", TopologyDashboardView.as_view(), name="topology_detail"),
    path("discovery/", CableDiscoveryView.as_view(), name="discovery"),
    path("api/", include("nautobot_topology.api.urls")),
]
