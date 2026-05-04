from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from nautobot.dcim.models import Location, LocationType
from nautobot.users.models import User
from nautobot.extras.models import Status


class TopologyLayoutAPITest(APITestCase):
    def setUp(self):
        # Create a user for authentication if needed
        self.user = User.objects.create(username="testuser", is_superuser=True)
        self.client.force_authenticate(user=self.user)

        # Site is now a Location with location_type Site
        self.active_status, _ = Status.objects.get_or_create(name="Active")
        self.site_type, _ = LocationType.objects.get_or_create(name="Site")
        self.site = Location.objects.create(name="Test Site", location_type=self.site_type, status=self.active_status)
        self.layout_url = reverse(
            "plugins-api:nautobot_topology-api:topology-layout",
            kwargs={"pk": self.site.pk},
        )

    def test_save_and_retrieve_layout(self):
        # 1. Initially layout should be empty
        response = self.client.get(self.layout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"], {"nodes": []})

        # 2. Save layout
        test_layout = {"node1": {"x": 100, "y": 200}, "node2": {"x": 300, "y": 400}}
        response = self.client.post(self.layout_url, test_layout, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "Layout saved")

        # 3. Retrieve layout and verify persistence
        response = self.client.get(self.layout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data"], test_layout)

    def test_update_layout(self):
        # 1. Save initial layout
        test_layout_1 = {"node1": {"x": 100, "y": 200}}
        self.client.post(self.layout_url, test_layout_1, format="json")

        # 2. Update layout
        test_layout_2 = {"node1": {"x": 500, "y": 600}, "node2": {"x": 10, "y": 10}}
        response = self.client.post(self.layout_url, test_layout_2, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # 3. Verify update
        response = self.client.get(self.layout_url)
        self.assertEqual(response.data["data"], test_layout_2)
