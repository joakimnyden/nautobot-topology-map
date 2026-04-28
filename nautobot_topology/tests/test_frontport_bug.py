from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIRequestFactory
from nautobot_topology.api.views import TopologyViewSet


class FrontPortBugTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    @patch("nautobot.dcim.models.Interface.objects.filter")
    @patch("nautobot.dcim.models.FrontPort.objects.filter")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    @patch("nautobot_topology.api.views.VLAN.objects.filter")
    @patch("nautobot_topology.api.views.Prefix.objects.filter")
    def test_retrieve_frontport_link(
        self,
        mock_prefix_filter,
        mock_vlan_filter,
        mock_cable_filter,
        mock_device_filter,
        mock_get_locs,
        mock_get_loc,
        mock_fp_filter,
        mock_iface_filter,
    ):
        mock_site = MagicMock()
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = [mock_site]

        # Mock devices
        dev1 = MagicMock()
        dev1.id = "dev1"
        dev1.name = "Dev 1"
        dev1.location_id = "123"
        dev1.role.name = "Edge"
        dev1.status.name = "Active"
        dev1.primary_ip4 = None

        mock_dev_qs = MagicMock()
        mock_dev_qs.__iter__.return_value = iter([dev1])
        mock_device_filter.return_value = mock_dev_qs

        # Mock Interface (empty)
        mock_iface_filter.return_value.values.return_value = []

        # Mock FrontPort (contains one side of a cable)
        mock_fp_filter.return_value.values.return_value = [
            {"id": "fp1", "device_id": "dev1", "device__name": "Dev 1", "name": "Port 1", "type": "lc"}
        ]

        # Mock Cable using FrontPort
        mock_cable_data = {
            "id": "789",
            "termination_a_id": "fp1",
            "termination_b_id": "fp1",  # Self loop for simplicity of test
            "label": "FrontPort Link",
            "type": "fiber",
        }
        mock_cable_qs = MagicMock()
        mock_cable_qs.values.return_value = [mock_cable_data]
        mock_cable_filter.return_value = mock_cable_qs

        mock_vlan_filter.return_value.values_list.return_value = []
        mock_prefix_filter.return_value.values_list.return_value = []

        request = self.factory.get("/api/plugins/nautobot_topology/topology/123/")
        view = TopologyViewSet.as_view({"get": "retrieve"})

        # This should NOT CRASH with KeyError
        response = view(request, pk="123")

        self.assertEqual(response.status_code, 200)
