from django.urls import path, include
from .views import TopologyDashboardView

urlpatterns = [
    path('dashboard/', TopologyDashboardView.as_view(), name='dashboard'),
    path('api/', include('nautobot_topology.api.urls')),
]
