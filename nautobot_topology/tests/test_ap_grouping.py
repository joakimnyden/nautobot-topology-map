from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory
from nautobot_topology.api.views import TopologyViewSet
from unittest.mock import MagicMock, patch


class APGroupingTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = TopologyViewSet.as_view({"get": "retrieve"})

    @override_settings(PLUGINS_CONFIG={"nautobot_topology": {"ap_role_name": "My Custom AP Role"}})
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    @patch("nautobot.dcim.models.Interface.objects.filter")
    @patch("nautobot.dcim.models.FrontPort.objects.filter")
    @patch("nautobot_topology.api.views.VLAN.objects.filter")
    @patch("nautobot_topology.api.views.Prefix.objects.filter")
    def test_custom_ap_role_grouping(
        self, mock_prefix, mock_vlan, mock_fp, mock_iface, mock_cable, mock_device, mock_loc_get, mock_get_locs
    ):
        # Mock site
        site = MagicMock()
        site.id = "site1"
        site.name = "Site 1"
        mock_loc_get.return_value = site
        mock_get_locs.return_value = ["site1"]

        # Mock devices
        # 1. Connected device (should be individual)
        dev1 = MagicMock()
        dev1.id = "dev1"
        dev1.name = "Router 1"
        dev1.role.name = "Router"
        dev1.location_id = "site1"
        dev1.location.name = "Site 1"
        dev1.primary_ip4 = None
        dev1.primary_ip6 = None
        dev1.status.name = "Active"

        # 2. Unconnected custom AP 1
        dev2 = MagicMock()
        dev2.id = "dev2"
        dev2.name = "AP 1"
        dev2.role.name = "My Custom AP Role"
        dev2.location_id = "site1"
        dev2.location.name = "Site 1"
        dev2.primary_ip4 = None
        dev2.primary_ip6 = None
        dev2.status.name = "Active"

        # 3. Unconnected custom AP 2
        dev3 = MagicMock()
        dev3.id = "dev3"
        dev3.name = "AP 2"
        dev3.role.name = "My Custom AP Role"
        dev3.location_id = "site1"
        dev3.location.name = "Site 1"
        dev3.primary_ip4 = None
        dev3.primary_ip6 = None
        dev3.status.name = "Active"

        # 4. Unconnected non-AP (Other) 1
        dev4 = MagicMock()
        dev4.id = "dev4"
        dev4.name = "Switch 1"
        dev4.role.name = "Switch"
        dev4.location_id = "site1"
        dev4.location.name = "Site 1"
        dev4.primary_ip4 = None
        dev4.primary_ip6 = None
        dev4.status.name = "Active"

        # 5. Unconnected non-AP (Other) 2
        dev5 = MagicMock()
        dev5.id = "dev5"
        dev5.name = "Switch 2"
        dev5.role.name = "Switch"
        dev5.location_id = "site1"
        dev5.location.name = "Site 1"
        dev5.primary_ip4 = None
        dev5.primary_ip6 = None
        dev5.status.name = "Active"

        # 6. Connected target device
        dev6 = MagicMock()
        dev6.id = "dev6"
        dev6.name = "Router 2"
        dev6.role.name = "Router"
        dev6.location_id = "site1"
        dev6.location.name = "Site 1"
        dev6.primary_ip4 = None
        dev6.primary_ip6 = None
        dev6.status.name = "Active"

        mock_dev_qs = MagicMock()
        mock_dev_qs.filter.return_value = mock_dev_qs
        mock_dev_qs.select_related.return_value = mock_dev_qs
        mock_dev_qs.__iter__.return_value = iter([dev1, dev2, dev3, dev4, dev5, dev6])
        mock_device.return_value = mock_dev_qs

        # Mock cables to connect dev1 and dev6
        # Interface data
        mock_iface.return_value.values.return_value = [
            {
                "id": "if1",
                "device_id": "dev1",
                "name": "Gi1",
                "lag_id": None,
                "type": "1000base-t",
                "speed": 1000000,
                "device__name": "Router 1",
            },
            {
                "id": "if6",
                "device_id": "dev6",
                "name": "Gi1",
                "lag_id": None,
                "type": "1000base-t",
                "speed": 1000000,
                "device__name": "Router 2",
            },
        ]
        # Cable data
        mock_cable.return_value.values.return_value = [
            {"id": "c1", "termination_a_id": "if1", "termination_b_id": "if6", "label": "", "type": ""}
        ]

        request = self.factory.get("/api/plugins/nautobot_topology/topology/site1/")
        from django.contrib.auth import get_user_model

        User = get_user_model()
        user = User(username="testuser", is_superuser=True)
        from rest_framework.test import force_authenticate

        force_authenticate(request, user=user)
        response = self.view(request, pk="site1")

        self.assertEqual(response.status_code, 200)
        nodes = response.data["data"]["nodes"]

        # Expected nodes:
        # 1. Router 1 (individual, ID: dev1)
        # 2. AP Group (group-site1-ap, Role: My Custom AP Role, Count: 2)
        # 3. Other Group (group-site1-other, Role: Other, Count: 2)

        node_ids = [n["id"] for n in nodes]
        self.assertIn("dev1", node_ids)
        self.assertIn("group-site1-ap", node_ids)
        self.assertIn("group-site1-other", node_ids)

        ap_group = next(n for n in nodes if n["id"] == "group-site1-ap")
        self.assertEqual(ap_group["role"], "My Custom AP Role")
        self.assertEqual(ap_group["deviceCount"], 2)

        other_group = next(n for n in nodes if n["id"] == "group-site1-other")
        self.assertEqual(other_group["role"], "Other")
        self.assertEqual(other_group["deviceCount"], 2)

        # Check config in response
        self.assertEqual(response.data["data"]["config"]["ap_role_name"], "My Custom AP Role")
