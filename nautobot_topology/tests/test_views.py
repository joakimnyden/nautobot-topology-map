from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from nautobot_topology.api.views import TopologyViewSet, get_locations_for_site

User = get_user_model()

class TopologyViewSetTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username='testuser', email='test@example.com', password='password')
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)
        self.view = TopologyViewSet()

    @patch('nautobot_topology.api.views.cache.get', return_value={'status': 'success', 'data': {'nodes': [], 'links': []}})
    def test_list_cached(self, mock_cache_get):
        response = self.client.get('/api/plugins/nautobot_topology/topology/')
        if response.status_code == 403:
            print(f"DEBUG 403: {response.data}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')

    @patch('nautobot_topology.api.views.cache.set')
    @patch('nautobot_topology.api.views.Location.objects.filter')
    @patch('nautobot_topology.api.views.cache.get', return_value=None)
    def test_list_uncached(self, mock_cache_get, mock_filter, mock_cache_set):
        mock_qs = MagicMock()
        mock_site = MagicMock()
        mock_site.id = "123e4567-e89b-12d3-a456-426614174000"
        mock_site.name = "Test Site"
        mock_site.latitude = 40.7128
        mock_site.longitude = -74.0060
        mock_site.device_count = 5
        mock_site.parent = None
        mock_qs.select_related.return_value.annotate.return_value = [mock_site]
        # Nautobot 3.1 filter behavior might be slightly different, so we mock it carefully
        mock_filter.return_value = mock_qs

        response = self.client.get('/api/plugins/nautobot_topology/topology/')
        
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(len(response.data['data']['nodes']), 1)
        self.assertEqual(response.data['data']['nodes'][0]['name'], "Test Site")

    @patch('nautobot_topology.api.views.cache.set')
    @patch('nautobot_topology.api.views.cache.get', return_value=None)
    def test_layout_post(self, mock_cache_get, mock_cache_set):
        response = self.client.post('/api/plugins/nautobot_topology/topology/123/layout/', {"layout": []}, format='json')
        self.assertEqual(response.status_code, 200)

    @patch('nautobot_topology.api.views.cache.get', return_value={"nodes": []})
    def test_layout_get_cached(self, mock_cache_get):
        response = self.client.get('/api/plugins/nautobot_topology/topology/123/layout/')
        self.assertEqual(response.status_code, 200)

    @patch('nautobot_topology.api.views.cache.get', return_value=None)
    def test_layout_get_uncached(self, mock_cache_get):
        response = self.client.get('/api/plugins/nautobot_topology/topology/123/layout/')
        self.assertEqual(response.status_code, 200)

    @patch('nautobot_topology.api.views.Location.objects.get')
    def test_retrieve_not_found(self, mock_get):
        import nautobot.dcim.models as dcim_models
        mock_get.side_effect = dcim_models.Location.DoesNotExist
        response = self.client.get('/api/plugins/nautobot_topology/topology/123/')
        self.assertEqual(response.status_code, 404)

    @patch('nautobot.dcim.models.Interface.objects.filter')
    @patch('nautobot.dcim.models.FrontPort.objects.filter')
    @patch('nautobot_topology.api.views.Location.objects.get')
    @patch('nautobot_topology.api.views.get_locations_for_site')
    @patch('nautobot_topology.api.views.Device.objects.filter')
    @patch('nautobot_topology.api.views.Cable.objects.filter')
    @patch('nautobot.ipam.models.VLAN.objects.filter')
    @patch('nautobot.ipam.models.Prefix.objects.filter')
    def test_retrieve_success(self, mock_prefix_filter, mock_vlan_filter, mock_cable_filter, mock_device_filter, mock_get_locs, mock_get_loc, mock_fp_filter, mock_iface_filter):
        mock_site = MagicMock()
        mock_site.id = "123"
        mock_get_loc.return_value = mock_site
        mock_get_locs.return_value = [mock_site]

        mock_device = MagicMock()
        mock_device.id = "456"
        mock_device.name = "Test Device"
        mock_device.location_id = "123"
        mock_device.role.name = "Edge"
        mock_device.platform.name = "Cisco"
        mock_device.device_type.manufacturer.name = "Cisco"
        mock_device.status.name = "Active"
        mock_device.primary_ip4.address.ip = "1.1.1.1"
        mock_device.interfaces.all.return_value = []
        
        mock_dev_qs = MagicMock()
        mock_dev_qs.filter.return_value = mock_dev_qs
        mock_dev_qs.select_related.return_value = mock_dev_qs
        mock_dev_qs.prefetch_related.return_value = mock_dev_qs
        mock_dev_qs.__iter__.return_value = iter([mock_device])
        mock_device_filter.return_value = mock_dev_qs

        mock_cable_data = {
            "id": "789",
            "termination_a_id": "iface1",
            "termination_b_id": "iface2",
            "label": "LinkA",
            "type": "copper"
        }
        mock_cable_qs = MagicMock()
        mock_cable_qs.values.return_value = [mock_cable_data]
        mock_cable_filter.return_value = mock_cable_qs
        
        mock_vlan_filter.return_value.values_list.return_value = []
        mock_prefix_filter.return_value.values_list.return_value = []
        
        mock_iface_filter.return_value.values.return_value = []
        mock_fp_filter.return_value.values.return_value = []

        response = self.client.get('/api/plugins/nautobot_topology/topology/123/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'success')
        
    def test_metrics_disabled(self):
        with patch('nautobot_topology.api.views.getattr') as mock_getattr, \
             patch('nautobot_topology.api.views.Location.objects.get') as mock_get:
            mock_getattr.return_value.get.return_value = {'prometheus_enabled': False}
            mock_site = MagicMock()
            mock_get.return_value = mock_site
            response = self.client.get('/api/plugins/nautobot_topology/topology/123/metrics/')
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data['data']['metrics'], {})
