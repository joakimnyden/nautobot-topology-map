from django.test import TestCase
from nautobot_topology.api.serializers import DeviceSerializer
from unittest.mock import MagicMock


class DeviceSerializerTest(TestCase):
    def test_serializer(self):
        device = MagicMock()
        device.id = 1
        device.name = "Test Device"
        device.role.name = "Role"
        device.location.name = "Location"

        serializer = DeviceSerializer(device)
        self.assertEqual(serializer.data["name"], "Test Device")
        self.assertEqual(serializer.data["role"], "Role")
        self.assertEqual(serializer.data["location"], "Location")
