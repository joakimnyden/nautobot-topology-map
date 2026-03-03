from rest_framework import serializers
from nautobot.dcim.models import Device

class DeviceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Device
        fields = ['id', 'name', 'device_role', 'site']
