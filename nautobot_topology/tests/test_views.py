"""
Unit tests for TopologyViewSet — all mocked, no DB interaction.
Uses Django's TestCase (not Nautobot's APITestCase) so no generate_test_data is triggered.
"""

from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from nautobot_topology.api.views import get_locations_for_site

User = get_user_model()


class TopologyViewSetListTest(TestCase):
    """Tests for the global list endpoint (/topology/)."""

    def setUp(self):
        self.user = User.objects.create_superuser(username="tv_listuser", email="tv@example.com", password="password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch(
        "nautobot_topology.api.views.cache.get",
        return_value={"status": "success", "data": {"nodes": [], "links": []}},
    )
    def test_list_cached(self, mock_cache_get):
        response = self.client.get("/api/plugins/nautobot_topology/topology/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")

    @patch("nautobot_topology.api.views.cache.set")
    @patch("nautobot_topology.api.views.Location.objects.filter")
    @patch("nautobot_topology.api.views.cache.get", return_value=None)
    def test_list_uncached_with_coords(self, mock_cache_get, mock_filter, mock_cache_set):
        mock_qs = MagicMock()
        mock_site = MagicMock()
        mock_site.id = "123e4567-e89b-12d3-a456-426614174000"
        mock_site.name = "Test Site"
        mock_site.latitude = 40.7128
        mock_site.longitude = -74.0060
        mock_site.device_count = 5
        mock_site.parent = None
        mock_site.descendants.return_value.values_list.return_value = [mock_site.id]
        mock_qs.distinct.return_value.select_related.return_value.annotate.return_value = [mock_site]
        mock_filter.return_value = mock_qs

        response = self.client.get("/api/plugins/nautobot_topology/topology/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(len(response.data["data"]["nodes"]), 1)
        self.assertEqual(response.data["data"]["nodes"][0]["name"], "Test Site")

    @patch("nautobot_topology.api.views.cache.set")
    @patch("nautobot_topology.api.views.Location.objects.filter")
    @patch("nautobot_topology.api.views.cache.get", return_value=None)
    def test_list_uncached_no_coords_skipped(self, mock_cache_get, mock_filter, mock_cache_set):
        """Sites without coordinates are excluded from the global view."""
        mock_qs = MagicMock()
        mock_site = MagicMock()
        mock_site.id = "aaa"
        mock_site.name = "No Coords Site"
        mock_site.latitude = None
        mock_site.longitude = None
        mock_qs.distinct.return_value.select_related.return_value.annotate.return_value = [mock_site]
        mock_filter.return_value = mock_qs

        response = self.client.get("/api/plugins/nautobot_topology/topology/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["data"]["nodes"]), 0)


class TopologyViewSetRetrieveTest(TestCase):
    """Tests for the site detail endpoint (/topology/<pk>/)."""

    def setUp(self):
        self.user = User.objects.create_superuser(username="tv_retuser", email="tvret@example.com", password="password")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_retrieve_not_found(self, mock_get):
        import nautobot.dcim.models as dcim_models

        mock_get.side_effect = dcim_models.Location.DoesNotExist
        response = self.client.get("/api/plugins/nautobot_topology/topology/123/")
        self.assertEqual(response.status_code, 404)

    @patch("nautobot_topology.api.views.TopologyViewSet._get_bgp_links", return_value=[])
    @patch("nautobot.dcim.models.Interface.objects.filter")
    @patch("nautobot.dcim.models.FrontPort.objects.filter")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    @patch("nautobot_topology.api.views.VLAN.objects.filter")
    @patch("nautobot_topology.api.views.Prefix.objects.filter")
    def test_retrieve_success(
        self,
        mock_prefix,
        mock_vlan,
        mock_cable,
        mock_device,
        mock_get_locs,
        mock_get_loc,
        mock_fp,
        mock_iface,
        mock_bgp,
    ):
        mock_site = MagicMock()
        mock_site.id = "123"
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = ["123"]

        mock_dev = MagicMock()
        mock_dev.id = "456"
        mock_dev.name = "Test Device"
        mock_dev.location_id = "123"
        mock_dev.role.name = "Edge"
        mock_dev.platform.name = "Cisco"
        mock_dev.device_type.manufacturer.name = "Cisco"
        mock_dev.device_type.model = "CSR1000v"
        mock_dev.status.name = "Active"
        mock_dev.primary_ip4.address.ip = "1.1.1.1"
        mock_dev.primary_ip6 = None
        mock_dev.get_absolute_url.return_value = "/dcim/devices/456/"

        mock_dev_qs = MagicMock()
        mock_dev_qs.filter.return_value = mock_dev_qs
        mock_dev_qs.select_related.return_value = mock_dev_qs
        mock_dev_qs.__iter__.return_value = iter([mock_dev])
        mock_device.return_value = mock_dev_qs

        mock_cable_qs = MagicMock()
        mock_cable_qs.values.return_value = []
        mock_cable.return_value = mock_cable_qs

        mock_vlan.return_value.values_list.return_value = []
        mock_prefix.return_value.values_list.return_value = []
        mock_iface.return_value.values.return_value = []
        mock_fp.return_value.values.return_value = []

        response = self.client.get("/api/plugins/nautobot_topology/topology/123/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")

    @patch("nautobot_topology.api.views.TopologyViewSet._get_bgp_links", return_value=[])
    @patch("nautobot.dcim.models.Interface.objects.filter")
    @patch("nautobot.dcim.models.FrontPort.objects.filter")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    @patch("nautobot_topology.api.views.VLAN.objects.filter")
    @patch("nautobot_topology.api.views.Prefix.objects.filter")
    def test_retrieve_unconnected_devices_grouped(
        self,
        mock_prefix,
        mock_vlan,
        mock_cable,
        mock_device,
        mock_get_locs,
        mock_get_loc,
        mock_fp,
        mock_iface,
        mock_bgp,
    ):
        """Multiple unconnected devices in the same location are grouped."""
        mock_site = MagicMock()
        mock_site.id = "site1"
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = ["site1"]

        def make_dev(dev_id, name, role):
            d = MagicMock()
            d.id = dev_id
            d.name = name
            d.role.name = role
            d.location_id = "loc1"
            d.location.name = "Floor 1"
            d.status.name = "Active"
            d.primary_ip4 = None
            d.primary_ip6 = None
            d.get_absolute_url.return_value = f"/dcim/devices/{dev_id}/"
            return d

        devs = [
            make_dev("d1", "AP-01", "Access Points"),
            make_dev("d2", "AP-02", "Access Points"),
        ]

        mock_dev_qs = MagicMock()
        mock_dev_qs.filter.return_value = mock_dev_qs
        mock_dev_qs.select_related.return_value = mock_dev_qs
        mock_dev_qs.__iter__.return_value = iter(devs)
        mock_device.return_value = mock_dev_qs

        mock_cable_qs = MagicMock()
        mock_cable_qs.values.return_value = []
        mock_cable.return_value = mock_cable_qs

        mock_vlan.return_value.values_list.return_value = []
        mock_prefix.return_value.values_list.return_value = []
        mock_iface.return_value.values.return_value = []
        mock_fp.return_value.values.return_value = []

        response = self.client.get("/api/plugins/nautobot_topology/topology/site1/")
        self.assertEqual(response.status_code, 200)
        # 2 APs in same location → one group node
        nodes = response.data["data"]["nodes"]
        self.assertEqual(len(nodes), 1)
        self.assertEqual(nodes[0]["type"], "group")
        self.assertEqual(nodes[0]["deviceCount"], 2)


class TopologyViewSetLayoutTest(TestCase):
    """Tests for the layout GET/POST endpoint (/topology/<pk>/layout/)."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="tv_layoutuser", email="tvlayout@example.com", password="password"
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_layout_post_saves(self, mock_loc_get):
        mock_site = MagicMock()
        mock_site.pk = "123"
        mock_loc_get.return_value = mock_site
        with patch("nautobot_topology.models.TopologyLayout.objects.update_or_create"):
            response = self.client.post(
                "/api/plugins/nautobot_topology/topology/123/layout/",
                {"node1": {"x": 10, "y": 20}},
                format="json",
            )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["message"], "Layout saved")

    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_layout_get_with_saved_data(self, mock_loc_get):
        mock_site = MagicMock()
        mock_site.pk = "123"
        mock_loc_get.return_value = mock_site
        with patch("nautobot_topology.models.TopologyLayout.objects.get") as mock_layout_get:
            mock_layout = MagicMock()
            mock_layout.layout_data = {"node1": {"x": 10, "y": 20}}
            mock_layout_get.return_value = mock_layout
            response = self.client.get("/api/plugins/nautobot_topology/topology/123/layout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"], {"node1": {"x": 10, "y": 20}})

    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_layout_get_no_saved_data_returns_empty(self, mock_loc_get):
        mock_site = MagicMock()
        mock_site.pk = "123"
        mock_loc_get.return_value = mock_site
        with patch("nautobot_topology.models.TopologyLayout.objects.get") as mock_layout_get:
            from nautobot_topology.models import TopologyLayout

            mock_layout_get.side_effect = TopologyLayout.DoesNotExist
            response = self.client.get("/api/plugins/nautobot_topology/topology/123/layout/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"], {"nodes": []})

    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_layout_site_not_found(self, mock_loc_get):
        import nautobot.dcim.models as dcim_models

        mock_loc_get.side_effect = dcim_models.Location.DoesNotExist
        response = self.client.get("/api/plugins/nautobot_topology/topology/nope/layout/")
        self.assertEqual(response.status_code, 404)


class TopologyViewSetMetricsTest(TestCase):
    """Tests for the metrics endpoint (/topology/<pk>/metrics/)."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username="tv_metricsuser",
            email="tvmetrics@example.com",
            password="password",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @override_settings(PLUGINS_CONFIG={"nautobot_topology": {"prometheus_enabled": False}})
    def test_metrics_disabled(self):
        with (patch("nautobot_topology.api.views.Location.objects.get") as mock_get,):
            mock_get.return_value = MagicMock()
            response = self.client.get("/api/plugins/nautobot_topology/topology/123/metrics/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["metrics"], {})


class GetLocationsForSiteTest(TestCase):
    """Unit tests for the get_locations_for_site helper."""

    def test_returns_list_of_ids(self):
        mock_site = MagicMock()
        mock_site.descendants.return_value.values_list.return_value = ["id1", "id2"]
        result = get_locations_for_site(mock_site)
        self.assertEqual(result, ["id1", "id2"])
        mock_site.descendants.assert_called_once_with(include_self=True)
