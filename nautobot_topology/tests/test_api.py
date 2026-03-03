from django.urls import reverse
from rest_framework import status
from nautobot.apps.testing import APIViewTestCases
from nautobot.dcim.models import Device, DeviceRole, DeviceType, Manufacturer, Site

class TopologyAPITest(APIViewTestCases.APIViewTestCase):
    def setUp(self):
        super().setUp()
        
        self.manufacturer = Manufacturer.objects.create(name="Manufacturer 1")
        self.device_type = DeviceType.objects.create(
            manufacturer=self.manufacturer,
            model="Model 1"
        )
        self.device_role = DeviceRole.objects.create(name="Role 1", color="ff0000")
        self.site = Site.objects.create(name="Site 1")
        
        self.device = Device.objects.create(
            name="Device 1",
            device_type=self.device_type,
            device_role=self.device_role,
            site=self.site,
            status="Active"
        )

    def test_list_topology(self):
        url = reverse("plugins-api:nautobot_topology-api:topology-list")
        response = self.client.get(url, **self.header)
        
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "success")
        self.assertTrue(len(response.data["data"]["nodes"]) > 0)
        self.assertEqual(response.data["data"]["nodes"][0]["name"], "Device 1")
