from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from rest_framework.test import APIRequestFactory
from nautobot_topology.api.views import TopologyViewSet
import nautobot.dcim.models as dcim_models

class TopologyViewSetExtraTest(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.retrieve_view = TopologyViewSet.as_view({'get': 'retrieve'})
        self.list_view = TopologyViewSet.as_view({'get': 'list'})

    @override_settings(PLUGINS_CONFIG={'nautobot_topology': {
        'allowed_statuses': ['Active'],
        'allowed_device_types': [],
        'topology_style': 'fancy',
        'prometheus_enabled': True,
        'prometheus_url': 'mock'
    }})
    @patch('nautobot.dcim.models.Interface.objects.filter')
    @patch('nautobot.dcim.models.FrontPort.objects.filter')
    @patch('nautobot_topology.api.views.cache.set')
    @patch('nautobot_topology.api.views.cache.get', return_value=None)
    @patch('nautobot_topology.api.views.Location.objects.get')
    @patch('nautobot_topology.api.views.Location.objects.filter')
    @patch('nautobot_topology.api.views.Device.objects.filter')
    @patch('nautobot_topology.api.views.Cable.objects.filter')
    @patch('nautobot_topology.api.views.VLAN.objects.filter')
    @patch('nautobot_topology.api.views.Prefix.objects.filter')
    def test_retrieve_complex_branches(self, mock_prefix_filter, mock_vlan_filter, mock_cable_filter, mock_device_filter, mock_loc_filter, mock_get_loc, mock_cache_get, mock_cache_set, mock_fp_filter, mock_iface_filter):

        mock_site = MagicMock()
        mock_site.id = "123"
        mock_site.name = "Site 1"
        mock_site.descendants.return_value.values_list.return_value = ["123"]
        mock_get_loc.return_value = mock_site

        # Device with VLANs, IP addresses, and IPv6
        dev1 = MagicMock()
        dev1.id = "dev1"
        dev1.name = "Dev 1"
        dev1.role.name = "Edge"
        dev1.status.name = "Active"
        dev1.primary_ip4 = None
        dev1.primary_ip6.address.ip = "2001:db8::1"
        dev1.location_id = "loc1"
        
        iface = MagicMock()
        iface.untagged_vlan.vid = 10
        iface.untagged_vlan.name = "V1"
        v2 = MagicMock()
        v2.vid = 20
        v2.name = "V2"
        iface.tagged_vlans.all.return_value = [v2]
        ip = MagicMock()
        ip.address.cidr = "192.168.1.1/24"
        iface.ip_addresses.all.return_value = [ip]
        dev1.interfaces.all.return_value = [iface]

        # Device 2: Unconnected AP
        dev2 = MagicMock()
        dev2.id = "dev2"
        dev2.name = "AP 1"
        dev2.status.name = "Active"
        dev2.role.name = "Access Point"
        dev2.location_id = "loc1"
        dev2.location.name = "Loc 1"
        dev2.interfaces.all.return_value = []
        dev2.primary_ip4 = None

        devices = [dev1, dev2]
        mock_dev_qs = MagicMock()
        mock_dev_qs.filter.return_value = mock_dev_qs
        mock_dev_qs.select_related.return_value = mock_dev_qs
        mock_dev_qs.prefetch_related.return_value = mock_dev_qs
        mock_dev_qs.__iter__.return_value = iter(devices)
        mock_device_filter.return_value = mock_dev_qs

        # Mock cable filter
        mock_cable_qs = MagicMock()
        mock_cable_qs.values.return_value = []
        mock_cable_filter.return_value = mock_cable_qs
        
        # Mock VLAN/Prefix aggregation
        mock_vlan_filter.return_value.values_list.return_value = [(100, "S1")]
        mock_prefix_filter.return_value.values_list.return_value = [("10.0.0.0", 8)]

        # Mock Interface/FrontPort aggregation
        mock_iface_filter.return_value.values.return_value = []
        mock_fp_filter.return_value.values.return_value = []

        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User(username='testuser', is_superuser=True)
        from rest_framework.test import force_authenticate
        request = self.factory.get('/api/plugins/nautobot_topology/topology/123/')
        force_authenticate(request, user=user)
        response = self.retrieve_view(request, pk='123')
        
        self.assertEqual(response.status_code, 200)
        data = response.data['data']
        self.assertEqual(len(data['nodes']), 2) # dev1 and single dev2 (since it's only 1 unconnected dev, it should be individual)
        
    @patch('nautobot_topology.api.views.cache.set')
    @patch('nautobot_topology.api.views.cache.get', return_value=None)
    @patch('nautobot_topology.api.views.Location.objects.filter')
    def test_list_missing_coords(self, mock_filter, mock_cache_get, mock_cache_set):
        site1 = MagicMock()
        site1.id = "1"
        site1.name = "S1"
        site1.latitude = 10.0
        site1.longitude = 10.0
        site1.parent = None
        site1.device_count = 0
        
        site2 = MagicMock()
        site2.id = "2"
        site2.latitude = None
        site2.longitude = 10.0
        
        mock_qs = MagicMock()
        mock_qs.select_related.return_value.annotate.return_value = [site1, site2]
        mock_filter.return_value = mock_qs
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User(username='testuser', is_superuser=True)
        from rest_framework.test import force_authenticate
        request = self.factory.get('/api/plugins/nautobot_topology/topology/')
        force_authenticate(request, user=user)
        response = self.list_view(request)
        self.assertEqual(len(response.data['data']['nodes']), 1)
