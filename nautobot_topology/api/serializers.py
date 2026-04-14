from rest_framework import serializers
from nautobot.dcim.models import Device

class DeviceSerializer(serializers.ModelSerializer):
    role = serializers.CharField(source='role.name', read_only=True)
    location = serializers.CharField(source='location.name', read_only=True)

    class Meta:
        model = Device
        fields = ['id', 'name', 'role', 'location']