from unittest.mock import patch, MagicMock
from django.test import TestCase
from rest_framework.test import APIRequestFactory
from nautobot_topology.api.views import TopologyViewSet


class TopologyMetricsTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = TopologyViewSet.as_view({"get": "metrics"})

    @patch("nautobot_topology.api.views.cache.set")
    @patch("nautobot_topology.api.views.getattr")
    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_metrics_disabled(self, mock_get_loc, mock_getattr, mock_cache_set):
        # Mock plugin config to disable prometheus
        mock_getattr.return_value.get.return_value = {"prometheus_enabled": False}

        request = self.factory.get("/api/plugins/nautobot_topology/topology/123/metrics/")
        response = self.view(request, pk="123")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertEqual(response.data["data"]["metrics"], {})

    @patch("nautobot_topology.api.views.Location.objects.get")
    def test_metrics_site_not_found(self, mock_get_loc):
        import nautobot.dcim.models as dcim_models

        mock_get_loc.side_effect = dcim_models.Location.DoesNotExist
        request = self.factory.get("/api/plugins/nautobot_topology/topology/nonexistent/metrics/")
        response = self.view(request, pk="nonexistent")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data["status"], "error")

    @patch("nautobot_topology.api.views.getattr")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    def test_metrics_mock_enabled(
        self,
        mock_cable_filter,
        mock_device_filter,
        mock_get_locs,
        mock_get_loc,
        mock_getattr,
    ):
        # Mock plugin config to enable prometheus with mock data
        mock_getattr.return_value.get.return_value = {
            "prometheus_enabled": True,
            "prometheus_url": "mock",
        }

        mock_site = MagicMock()
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = [mock_site]

        # Mock a cable
        mock_cable = MagicMock()
        mock_cable.id = "cable1"
        mock_cable.termination_a.device.name = "dev1"
        mock_cable.termination_a.name = "eth0"
        mock_cable.termination_b.device.name = "dev2"
        mock_cable.termination_b.name = "eth1"

        mock_cable_qs = MagicMock()
        mock_cable_qs.select_related.return_value = [mock_cable]
        mock_cable_filter.return_value = mock_cable_qs

        request = self.factory.get("/api/plugins/nautobot_topology/topology/123/metrics/")
        response = self.view(request, pk="123")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "success")
        self.assertIn("cable1", response.data["data"]["metrics"])
        self.assertIn("tx", response.data["data"]["metrics"]["cable1"])
        self.assertIn("rx", response.data["data"]["metrics"]["cable1"])
        self.assertIn("utilization", response.data["data"]["metrics"]["cable1"])

    @patch("nautobot_topology.api.views.getattr")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    def test_metrics_cable_missing_device(
        self,
        mock_cable_filter,
        mock_device_filter,
        mock_get_locs,
        mock_get_loc,
        mock_getattr,
    ):
        mock_getattr.return_value.get.return_value = {
            "prometheus_enabled": True,
            "prometheus_url": "mock",
        }
        mock_site = MagicMock()
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = [mock_site]

        # Mock device filter to return a QuerySet-like object (line 320)
        mock_dev_qs = MagicMock()
        mock_dev_qs.values_list.return_value = []
        mock_device_filter.return_value = mock_dev_qs

        # Cable with no device on termination (line 338)
        mock_cable = MagicMock()
        mock_cable.id = "badcable"
        del mock_cable.termination_a.device

        mock_cable_qs = MagicMock()
        mock_cable_qs.select_related.return_value = [mock_cable]
        mock_cable_filter.return_value = mock_cable_qs

        request = self.factory.get("/api/plugins/nautobot_topology/topology/123/metrics/")
        response = self.view(request, pk="123")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["metrics"], {})

    @patch("nautobot_topology.api.views.getattr")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("requests.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    def test_metrics_prometheus_query(
        self,
        mock_cable_filter,
        mock_device_filter,
        mock_get_locs,
        mock_requests_get,
        mock_get_loc,
        mock_getattr,
    ):
        # Mock plugin config to enable prometheus with real URL
        mock_getattr.return_value.get.return_value = {
            "prometheus_enabled": True,
            "prometheus_url": "http://prom:9090",
            "prometheus_query_tx": "rate(tx[{device},{interface}])",
            "prometheus_query_rx": "rate(rx[{device},{interface}])",
        }

        mock_site = MagicMock()
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = [mock_site]

        # Mock a cable
        mock_cable = MagicMock()
        mock_cable.id = "cable1"
        mock_cable.termination_a.device.name = "dev1"
        mock_cable.termination_a.name = "eth0"
        mock_cable.termination_b.device.name = "dev2"
        mock_cable.termination_b.name = "eth1"

        mock_cable_qs = MagicMock()
        mock_cable_qs.select_related.return_value = [mock_cable]
        mock_cable_filter.return_value = mock_cable_qs

        # Mock prometheus response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "status": "success",
            "data": {"result": [{"value": [0, "1234.56"]}]},
        }
        mock_requests_get.return_value = mock_resp

        request = self.factory.get("/api/plugins/nautobot_topology/topology/123/metrics/")
        response = self.view(request, pk="123")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(mock_requests_get.call_count, 2)  # TX and RX queries
        self.assertEqual(response.data["data"]["metrics"]["cable1"]["tx"], 1234.56)

    @patch("nautobot_topology.api.views.getattr")
    @patch("nautobot_topology.api.views.Location.objects.get")
    @patch("requests.get")
    @patch("nautobot_topology.api.views.get_locations_for_site")
    @patch("nautobot_topology.api.views.Device.objects.filter")
    @patch("nautobot_topology.api.views.Cable.objects.filter")
    def test_metrics_prometheus_error(
        self,
        mock_cable_filter,
        mock_device_filter,
        mock_get_locs,
        mock_requests_get,
        mock_get_loc,
        mock_getattr,
    ):
        mock_getattr.return_value.get.return_value = {
            "prometheus_enabled": True,
            "prometheus_url": "http://prom:9090",
            "prometheus_query_tx": "q",
            "prometheus_query_rx": "q",
        }
        mock_get_loc.return_value = MagicMock()
        mock_get_locs.return_value = []

        # Mock device filter
        mock_dev_qs = MagicMock()
        mock_dev_qs.values_list.return_value = []
        mock_device_filter.return_value = mock_dev_qs

        mock_cable = MagicMock()
        mock_cable.id = "cable1"
        mock_cable_qs = MagicMock()
        mock_cable_qs.select_related.return_value = [mock_cable]
        mock_cable_filter.return_value = mock_cable_qs

        # Mock Prometheus error (line 365-367)
        mock_requests_get.side_effect = Exception("Network error")

        request = self.factory.get("/api/plugins/nautobot_topology/topology/123/metrics/")
        response = self.view(request, pk="123")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["data"]["metrics"]["cable1"]["tx"], 0.0)
