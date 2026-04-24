from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from nautobot.dcim.models import Location, LocationType
from nautobot.users.models import User, ObjectPermission
from django.contrib.contenttypes.models import ContentType
from ..models import TopologyLayout

class TopologyPermissionsTest(APITestCase):
    def setUp(self):
        from nautobot.extras.models import Status
        
        # Setup location structure
        self.site_type, _ = LocationType.objects.get_or_create(name="Site")
        self.active_status = Status.objects.get(name="Active")
        
        self.site = Location.objects.create(
            name="Test Site Permissions",
            location_type=self.site_type,
            status=self.active_status
        )
        
        # Create users
        self.user = User.objects.create(username="testuser", is_superuser=False)
        
        # URLs
        self.list_url = reverse("plugins-api:nautobot_topology-api:topology-list")
        self.layout_url = reverse(
            "plugins-api:nautobot_topology-api:topology-layout",
            kwargs={"pk": self.site.pk}
        )

    def test_anonymous_access_denied(self):
        """Verify that unauthenticated users cannot access the API."""
        self.client.logout()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_without_perms_denied(self):
        """Verify that an authenticated user without permissions is blocked."""
        self.client.force_authenticate(user=self.user)
        
        # Test Global View
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_user_with_view_perms_allowed(self):
        """Verify that a user with view_topologylayout can access the maps."""
        obj_perm = ObjectPermission.objects.create(
            name="View Topology",
            actions=["view"]
        )
        obj_perm.users.add(self.user)
        obj_perm.object_types.add(ContentType.objects.get_for_model(TopologyLayout))
        obj_perm.save()

        self.client.force_authenticate(user=self.user)
        
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        
        response = self.client.get(self.layout_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_save_layout_requires_change_perm(self):
        """Verify that saving a layout requires change permissions."""
        # Grant ONLY view permission
        obj_perm = ObjectPermission.objects.create(
            name="View Only",
            actions=["view"]
        )
        obj_perm.users.add(self.user)
        obj_perm.object_types.add(ContentType.objects.get_for_model(TopologyLayout))
        obj_perm.save()

        self.client.force_authenticate(user=self.user)
        
        # Attempt to save layout (POST)
        test_layout = {"node1": {"x": 10, "y": 20}}
        response = self.client.post(self.layout_url, test_layout, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Now grant change permission
        obj_perm.actions = ["view", "change"]
        obj_perm.save()
        
        # In DRF tests, force_authenticate doesn't always pick up model changes
        # Re-fetch user to be safe
        self.user = User.objects.get(pk=self.user.pk)
        self.client.force_authenticate(user=self.user)
        
        response = self.client.post(self.layout_url, test_layout, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
