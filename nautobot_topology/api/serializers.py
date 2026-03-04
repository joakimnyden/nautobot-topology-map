from rest_framework import serializers
from nautobot.dcim.models import Device

class DeviceSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='device_role.name', read_only=True)
    site = serializers.CharField(source='site.name', read_only=True)

    class Meta:
        model = Device
        fields = ['id', 'name', 'role', 'site']