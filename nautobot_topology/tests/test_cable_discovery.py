"""
Unit tests for Cable Discovery endpoints and the discovery.py module.
All mocked — no real network connections, no generate_test_data.
"""
from unittest.mock import patch, MagicMock, call
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient, APIRequestFactory
from nautobot_topology.api.views import TopologyViewSet

User = get_user_model()


class CableDiscoveryViewTest(TestCase):
    """Tests for the Cable Discovery UI view."""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='cd_view_user', email='cdview@example.com', password='password'
        )
        from django.test import Client
        self.client = Client()
        self.client.force_login(self.user)

    @patch('nautobot_topology.views.render')
    def test_get_discovery_view(self, mock_render):
        from django.http import HttpResponse
        mock_render.return_value = HttpResponse("OK", status=200)
        from django.urls import reverse
        # Try both namespaced and non-namespaced just in case
        try:
            url = reverse('plugins:nautobot_topology:discovery')
        except:
            url = '/plugins/topology-map/discovery/'
        
        response = self.client.get(url)
        self.assertEqual(response.status_code, 200)
        mock_render.assert_called_once()



class DiscoverCablesEndpointTest(TestCase):
    """Tests for GET /topology/<device_pk>/discover_cables/"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='cd_user', email='cd@example.com', password='password'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('nautobot_topology.api.views.Device.objects.get')
    def test_device_not_found(self, mock_dev_get):
        import nautobot.dcim.models as dcim_models
        mock_dev_get.side_effect = dcim_models.Device.DoesNotExist
        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/bad-pk/discover_cables/'
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['status'], 'error')
        self.assertEqual(response.data['message'], 'Device not found')

    @patch('nautobot_topology.api.views.discover_neighbors')
    @patch('nautobot_topology.api.views.Device.objects.get')
    def test_discover_success(self, mock_dev_get, mock_discover):
        mock_device = MagicMock()
        mock_device.id = "abc"
        mock_dev_get.return_value = mock_device

        mock_discover.return_value = [
            {
                "local_interface": "Gi0/1",
                "remote_device": "router-02",
                "remote_interface": "Gi0/1",
                "protocol": "LLDP",
                "is_matched": True,
                "cable_exists": False,
            }
        ]

        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/abc/discover_cables/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']), 1)
        self.assertEqual(response.data['data'][0]['remote_device'], 'router-02')
        mock_discover.assert_called_once_with("abc")

    @patch('nautobot_topology.api.views.discover_neighbors')
    @patch('nautobot_topology.api.views.Device.objects.get')
    def test_discover_raises_exception(self, mock_dev_get, mock_discover):
        mock_device = MagicMock()
        mock_device.id = "abc"
        mock_dev_get.return_value = mock_device
        mock_discover.side_effect = ConnectionError("SSH failed")

        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/abc/discover_cables/'
        )
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data['status'], 'error')
        self.assertIn("SSH failed", response.data['message'])


class DevicesEndpointTest(TestCase):
    """Tests for GET /topology/<site_pk>/devices/"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='dev_ep_user', email='devep@example.com', password='password'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch('nautobot_topology.api.views.Location.objects.get')
    def test_devices_site_not_found(self, mock_loc_get):
        import nautobot.dcim.models as dcim_models
        mock_loc_get.side_effect = dcim_models.Location.DoesNotExist
        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/bad-pk/devices/'
        )
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.data['status'], 'error')

    @patch('nautobot_topology.api.views.Device.objects.filter')
    @patch('nautobot_topology.api.views.get_locations_for_site')
    @patch('nautobot_topology.api.views.Location.objects.get')
    def test_devices_success(self, mock_loc_get, mock_get_locs, mock_dev_filter):
        mock_site = MagicMock()
        mock_site.id = "site1"
        mock_loc_get.return_value = mock_site
        mock_get_locs.return_value = ["loc1"]

        dev = MagicMock()
        dev.id = "d1"
        dev.name = "Router-01"
        dev.role.name = "Router"
        dev.status.name = "Active"
        dev.primary_ip4.address.ip = "10.0.0.1"
        dev.primary_ip6 = None
        dev.location.name = "Site 1"
        dev.location.display = "Site 1"

        mock_qs = MagicMock()
        mock_qs.select_related.return_value = [dev]
        mock_dev_filter.return_value = mock_qs

        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/site1/devices/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['results']), 1)
        self.assertEqual(response.data['results'][0]['name'], 'Router-01')
        self.assertEqual(response.data['results'][0]['primary_ip4']['address'], '10.0.0.1')

    @patch('nautobot_topology.api.views.Device.objects.filter')
    @patch('nautobot_topology.api.views.get_locations_for_site')
    @patch('nautobot_topology.api.views.Location.objects.get')
    def test_devices_ipv6_only(self, mock_loc_get, mock_get_locs, mock_dev_filter):
        mock_site = MagicMock()
        mock_loc_get.return_value = mock_site
        mock_get_locs.return_value = ["loc1"]

        dev = MagicMock()
        dev.id = "d2"
        dev.name = "Router-IPv6"
        dev.role.name = "Router"
        dev.status.name = "Active"
        dev.primary_ip4 = None
        dev.primary_ip6.address.ip = "2001:db8::1"
        dev.location.name = "Site 1"
        dev.location.display = "Site 1"

        mock_qs = MagicMock()
        mock_qs.select_related.return_value = [dev]
        mock_dev_filter.return_value = mock_qs

        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/site1/devices/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['results'][0]['primary_ip4']['address'], '2001:db8::1')

    @patch('nautobot_topology.api.views.Device.objects.filter')
    @patch('nautobot_topology.api.views.get_locations_for_site')
    @patch('nautobot_topology.api.views.Location.objects.get')
    def test_devices_no_ip(self, mock_loc_get, mock_get_locs, mock_dev_filter):
        mock_site = MagicMock()
        mock_loc_get.return_value = mock_site
        mock_get_locs.return_value = ["loc1"]

        dev = MagicMock()
        dev.id = "d3"
        dev.name = "NoIP-Device"
        dev.role.name = "Switch"
        dev.status.name = "Active"
        dev.primary_ip4 = None
        dev.primary_ip6 = None
        dev.location.name = "Site 1"
        dev.location.display = "Site 1"

        mock_qs = MagicMock()
        mock_qs.select_related.return_value = [dev]
        mock_dev_filter.return_value = mock_qs

        response = self.client.get(
            '/api/plugins/nautobot_topology/topology/site1/devices/'
        )
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['results'][0]['primary_ip4'])


class ImportCablesEndpointTest(TestCase):
    """Tests for POST /topology/import_cables/"""

    def setUp(self):
        self.user = User.objects.create_superuser(
            username='ic_user', email='ic@example.com', password='password'
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.url = '/api/plugins/nautobot_topology/topology/import_cables/'

    @patch('nautobot_topology.api.views.Status.objects.get')
    @patch('nautobot_topology.api.views.Cable')
    def test_import_cables_success(self, mock_cable_cls, mock_status_get):
        mock_status = MagicMock()
        mock_status_get.return_value = mock_status

        mock_cable_instance = MagicMock()
        mock_cable_instance.id = "new-cable-id"
        mock_cable_cls.return_value = mock_cable_instance

        with patch('nautobot.dcim.models.Interface') as mock_iface_cls:
            mock_iface_a = MagicMock()
            mock_iface_a.cable = None
            mock_iface_a.name = "Gi0/1"
            mock_iface_b = MagicMock()
            mock_iface_b.cable = None
            mock_iface_b.name = "Gi0/2"
            mock_iface_cls.objects.get.side_effect = [mock_iface_a, mock_iface_b]

            response = self.client.post(self.url, {
                "cables": [{
                    "local_interface_id": "if-a-id",
                    "remote_interface_id": "if-b-id",
                    "local_interface_type": "interface",
                    "remote_interface_type": "interface",
                    "type": "cat6a"
                }]
            }, format='json')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created'], 1)
        self.assertEqual(len(response.data['errors']), 0)

    def test_import_cables_missing_ids(self):
        """Missing interface IDs → error entry, no cable created."""
        with patch('nautobot_topology.api.views.Status.objects.get') as mock_status_get:
            mock_status_get.return_value = MagicMock()
            response = self.client.post(self.url, {
                "cables": [{"type": "cat6a"}]  # no interface IDs
            }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created'], 0)
        self.assertEqual(len(response.data['errors']), 1)
        self.assertIn("Missing", response.data['errors'][0])

    def test_import_cables_already_cabled(self):
        """Interface already has a cable → error entry."""
        with patch('nautobot.extras.models.Status.objects.get') as mock_status_get, \
             patch('nautobot.dcim.models.Interface.objects.get') as mock_iface_get:
            mock_status_get.return_value = MagicMock()

            mock_iface_a = MagicMock()
            mock_iface_a.cable = MagicMock()  # already cabled
            mock_iface_a.name = "Gi0/1"
            mock_iface_b = MagicMock()
            mock_iface_b.cable = None
            mock_iface_b.name = "Gi0/2"
            mock_iface_get.side_effect = [mock_iface_a, mock_iface_b]

            response = self.client.post(self.url, {
                "cables": [{
                    "local_interface_id": "if-a",
                    "remote_interface_id": "if-b",
                }]
            }, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created'], 0)
        self.assertGreater(len(response.data['errors']), 0)

    def test_import_cables_empty_list(self):
        with patch('nautobot_topology.api.views.Status.objects.get') as mock_status_get:
            mock_status_get.return_value = MagicMock()
            response = self.client.post(self.url, {"cables": []}, format='json')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['created'], 0)
        self.assertEqual(response.data['status'], 'success')


class DiscoveryModuleTest(TestCase):
    """Unit tests for discovery.py functions (no real network)."""

    def test_normalize_interface_name_gi(self):
        from nautobot_topology.api.discovery import normalize_interface_name
        self.assertEqual(normalize_interface_name("Gi1/0/1"), "gigabitethernet1/0/1")
        self.assertEqual(normalize_interface_name("Te1/0"), "tengigabitethernet1/0")
        self.assertEqual(normalize_interface_name("Fa0/1"), "fastethernet0/1")
        self.assertEqual(normalize_interface_name("Po1"), "port-channel1")
        self.assertEqual(normalize_interface_name(""), "")

    def test_guess_netmiko_device_type_no_platform(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type
        device = MagicMock()
        device.platform = None
        self.assertEqual(guess_netmiko_device_type(device), "cisco_ios")

    def test_guess_netmiko_device_type_by_network_driver(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type
        device = MagicMock()
        device.platform.network_driver = "arista_eos"
        device.platform.name = "EOS"
        device.platform.slug = "eos"
        self.assertEqual(guess_netmiko_device_type(device), "arista_eos")

    def test_guess_netmiko_device_type_junos(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type
        device = MagicMock()
        device.platform.network_driver = "juniper_junos"
        device.platform.name = "JunOS"
        device.platform.slug = "junos"
        self.assertEqual(guess_netmiko_device_type(device), "juniper_junos")

    def test_guess_netmiko_device_type_nxos(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type
        device = MagicMock()
        device.platform.network_driver = "cisco_nxos"
        device.platform.name = "NX-OS"
        device.platform.slug = "nxos"
        self.assertEqual(guess_netmiko_device_type(device), "cisco_nxos")

    def test_guess_netmiko_fallback_platform_name(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type
        device = MagicMock()
        device.platform.network_driver = ""
        device.platform.name = "Cisco IOS"
        device.platform.slug = "ios"
        self.assertEqual(guess_netmiko_device_type(device), "cisco_ios")

    @patch('nautobot_topology.api.discovery.Device.objects.get')
    def test_discover_neighbors_no_ip_raises(self, mock_dev_get):
        from nautobot_topology.api.discovery import discover_neighbors
        device = MagicMock()
        device.name = "no-ip-router"
        device.primary_ip4 = None
        device.primary_ip6 = None
        mock_dev_get.return_value = device
        with self.assertRaises(ValueError) as ctx:
            discover_neighbors("device-id")
        self.assertIn("no primary IP", str(ctx.exception))

    @patch('nautobot_topology.api.discovery.Device.objects.get')
    def test_discover_neighbors_no_secrets_raises(self, mock_dev_get):
        from nautobot_topology.api.discovery import discover_neighbors
        device = MagicMock()
        device.name = "router"
        device.primary_ip4.address.ip = "10.0.0.1"
        device.primary_ip6 = None
        device.secrets_group = None  # no secrets group
        mock_dev_get.return_value = device
        with self.assertRaises(ValueError) as ctx:
            discover_neighbors("device-id")
        self.assertIn("No secrets group", str(ctx.exception))

    def test_standardize_and_match_neighbors_matched(self):
        from nautobot_topology.api.discovery import standardize_and_match_neighbors
        local_dev = MagicMock()

        local_iface = MagicMock()
        local_iface.name = "GigabitEthernet1/0/1"
        local_iface.cable = None
        local_iface.lag = None
        local_dev.interfaces.all.return_value = [local_iface]
        local_dev.frontports = MagicMock()
        local_dev.frontports.all.return_value = []
        local_dev.rearports = MagicMock()
        local_dev.rearports.all.return_value = []
        local_dev.consoleports = MagicMock()
        local_dev.consoleports.all.return_value = []
        local_dev.consoleserverports = MagicMock()
        local_dev.consoleserverports.all.return_value = []

        remote_dev = MagicMock()
        remote_dev.id = "remote-dev-id"
        remote_iface = MagicMock()
        remote_iface.name = "GigabitEthernet0/1"
        remote_iface.cable = None
        remote_iface.lag = None
        remote_dev.interfaces.all.return_value = [remote_iface]
        remote_dev.frontports.all.return_value = []
        remote_dev.rearports.all.return_value = []
        remote_dev.consoleports.all.return_value = []
        remote_dev.consoleserverports.all.return_value = []

        with patch('nautobot_topology.api.discovery.Device.objects.filter') as mock_filter:
            mock_qs = MagicMock()
            mock_qs.exists.return_value = True
            mock_qs.first.return_value = remote_dev
            mock_filter.return_value = mock_qs

            results = standardize_and_match_neighbors(local_dev, [{
                "local_interface": "Gi1/0/1",
                "remote_device": "remote-router",
                "remote_interface": "Gi0/1",
                "protocol": "LLDP"
            }])

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]['is_matched'])
        self.assertEqual(results[0]['protocol'], 'LLDP')
        self.assertFalse(results[0]['cable_exists'])

    def test_standardize_and_match_neighbors_unmatched_device(self):
        from nautobot_topology.api.discovery import standardize_and_match_neighbors
        local_dev = MagicMock()
        local_dev.interfaces.all.return_value = []
        local_dev.frontports.all.return_value = []
        local_dev.rearports.all.return_value = []
        local_dev.consoleports.all.return_value = []
        local_dev.consoleserverports.all.return_value = []

        with patch('nautobot_topology.api.discovery.Device.objects.filter') as mock_filter:
            mock_qs = MagicMock()
            mock_qs.exists.return_value = False
            mock_filter.return_value = mock_qs

            results = standardize_and_match_neighbors(local_dev, [{
                "local_interface": "Gi0/1",
                "remote_device": "unknown-device",
                "remote_interface": "Gi0/1",
                "protocol": "CDP"
            }])

        self.assertEqual(len(results), 1)
        self.assertFalse(results[0]['is_matched'])
        self.assertIsNone(results[0]['remote_device_id'])
