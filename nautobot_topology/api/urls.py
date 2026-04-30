from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TopologyViewSet, DiscoveryViewSet

router = DefaultRouter()
router.register(r"topology", TopologyViewSet, basename="topology")
router.register(r"discovery", DiscoveryViewSet, basename="discovery")

app_name = "nautobot_topology"

urlpatterns = [
    path("", include(router.urls)),
]
