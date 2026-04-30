"""
Unit tests for cable discovery logic.
All mocked — no real network connections, no generate_test_data.
"""

import unittest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class DiscoveryAPITest(APITestCase):
    """Integration tests for the discovery API endpoints."""

    def setUp(self):
        User = get_user_model()
        self.user = User.objects.create(username="testuser", is_superuser=True)
        self.client.force_authenticate(user=self.user)
        self.discovery_url = reverse("plugins-api:nautobot_topology:discovery-discover-neighbors")

    @patch("nautobot_topology.api.views.discover_neighbors")
    def test_discover_neighbors_api_success(self, mock_discover):
        mock_discover.return_value = [{"local_interface": "Gi1/0/1", "remote_device": "SW-01"}]

        response = self.client.post(
            self.discovery_url, {"device_id": "00000000-0000-0000-0000-000000000001"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["local_interface"], "Gi1/0/1")

    @patch("nautobot_topology.api.views.discover_neighbors")
    def test_discover_neighbors_api_error(self, mock_discover):
        mock_discover.side_effect = ValueError("Test error")

        response = self.client.post(
            self.discovery_url, {"device_id": "00000000-0000-0000-0000-000000000001"}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(response.data["detail"], "Test error")


class DiscoveryModuleTest(TestCase):
    """Database-dependent tests (still using mocks for external parts)."""

    def setUp(self):
        # We don't need real data because we patch the filter/get calls
        pass

    @patch("nautobot_topology.api.discovery.ConnectHandler")
    @patch("nautobot_topology.api.discovery.Device.objects.get")
    def test_discover_neighbors_no_ip_raises(self, mock_dev_get, mock_connect):
        from nautobot_topology.api.discovery import discover_neighbors

        device = MagicMock()
        device.name = "no-ip-router"
        device.primary_ip4 = None
        device.primary_ip6 = None
        mock_dev_get.return_value = device

        with self.assertRaises(ValueError) as ctx:
            discover_neighbors("00000000-0000-0000-0000-000000000001")
        self.assertIn("no primary IP", str(ctx.exception))

    @patch("nautobot_topology.api.discovery.get_device_secrets")
    @patch("nautobot_topology.api.discovery.Device.objects.get")
    def test_discover_neighbors_no_secrets_raises(self, mock_dev_get, mock_secrets):
        from nautobot_topology.api.discovery import discover_neighbors

        device = MagicMock()
        device.name = "router"
        device.primary_ip4.address.ip = "10.0.0.1"
        device.primary_ip6 = None
        device.secrets_group = None
        mock_dev_get.return_value = device
        mock_secrets.return_value = None

        with self.assertRaises(ValueError) as ctx:
            discover_neighbors("00000000-0000-0000-0000-000000000001")
        self.assertIn("No secrets group", str(ctx.exception))

    def test_standardize_and_match_neighbors_matched(self):
        from nautobot_topology.api.discovery import standardize_and_match_neighbors

        local_dev = MagicMock()
        local_iface = MagicMock()
        local_iface.name = "GigabitEthernet1/0/1"
        local_iface.id = "local-id"
        local_dev.interfaces.all.return_value = [local_iface]
        local_dev.frontports.all.return_value = []
        local_dev.rearports.all.return_value = []
        local_dev.consoleports.all.return_value = []
        local_dev.consoleserverports.all.return_value = []

        remote_dev = MagicMock()
        remote_dev.id = "remote-dev-id"
        remote_iface = MagicMock()
        remote_iface.name = "GigabitEthernet0/1"
        remote_iface.id = "remote-if-id"
        remote_dev.interfaces.all.return_value = [remote_iface]
        remote_dev.frontports.all.return_value = []
        remote_dev.rearports.all.return_value = []
        remote_dev.consoleports.all.return_value = []
        remote_dev.consoleserverports.all.return_value = []

        with patch("nautobot_topology.api.discovery.Device.objects.filter") as mock_filter:
            mock_qs = MagicMock()
            mock_qs.exists.return_value = True
            mock_qs.first.return_value = remote_dev
            mock_filter.return_value = mock_qs

            results = standardize_and_match_neighbors(
                local_dev,
                [
                    {
                        "local_interface": "Gi1/0/1",
                        "remote_device": "remote-router",
                        "remote_interface": "Gi0/1",
                        "protocol": "LLDP",
                    }
                ],
            )

        self.assertEqual(len(results), 1)
        self.assertTrue(results[0]["is_matched"])
        self.assertEqual(results[0]["local_interface_id"], "local-id")
        self.assertEqual(results[0]["remote_device_id"], "remote-dev-id")


class DiscoveryLogicTest(unittest.TestCase):
    """Pure logic tests that don't need a database or Django app initialization."""

    def test_normalize_interface_name(self):
        from nautobot_topology.api.discovery import normalize_interface_name

        test_cases = [
            ("Gi1/0/1", "gigabitethernet1/0/1"),
            ("Te1/1", "tengigabitethernet1/1"),
            ("Fa0/1", "fastethernet0/1"),
            ("Eth1/1", "ethernet1/1"),
            ("Po10", "port-channel10"),
            ("xe-0/0/0", "xe-0/0/0"),
            ("ge-0/0/1", "ge-0/0/1"),
            ("xe0/0/0", "xe-0/0/0"),
            ("Vl10", "vlan10"),
            ("vlan 20", "vlan20"),
            ("Mgmt0", "mgmt0"),
        ]

        for input_name, expected in test_cases:
            self.assertEqual(normalize_interface_name(input_name), expected)

    def test_guess_netmiko_device_type_no_platform(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type

        mock_device = MagicMock()
        mock_device.platform = None
        mock_device.name = "Test-Device"
        self.assertEqual(guess_netmiko_device_type(mock_device), "cisco_ios")

    def test_guess_netmiko_device_type_junos(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type

        mock_device = MagicMock()
        mock_device.platform.network_driver = "juniper_junos"
        self.assertEqual(guess_netmiko_device_type(mock_device), "juniper_junos")

    def test_guess_netmiko_device_type_nxos(self):
        from nautobot_topology.api.discovery import guess_netmiko_device_type

        mock_device = MagicMock()
        mock_device.platform.network_driver = "cisco_nxos"
        self.assertEqual(guess_netmiko_device_type(mock_device), "cisco_nxos")
