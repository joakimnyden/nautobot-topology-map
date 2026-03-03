from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from nautobot.dcim.models import Device
from .serializers import DeviceSerializer

class TopologyViewSet(ViewSet):
    def list(self, request):
        # Optimize query: select_related for foreign keys and only fetch needed fields
        devices = Device.objects.select_related('device_role', 'site').only(
            'id', 'name', 'device_role__name', 'site__name'
        )
        serializer = DeviceSerializer(devices, many=True)
        return Response({
            "status": "success",
            "data": {
                "nodes": serializer.data,
                "links": []
            }
        })
