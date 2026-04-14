from django.conf import settings
from django.db.models import Count
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from nautobot.dcim.models import Device, Location, Cable
from nautobot.ipam.models import VLAN, Prefix
from .serializers import DeviceSerializer

def get_locations_for_site(site):
    """Get all descendant locations including self using Nautobot's native tree manager."""
    return site.descendants(include_self=True)

class TopologyViewSet(ViewSet):
    queryset = Location.objects.filter(location_type__name="Site")

    def list(self, request):
        import random
        from django.core.cache import cache
        from django.conf import settings

        # Load plugin configuration
        plugin_cfg = getattr(settings, 'PLUGINS_CONFIG', {}).get('nautobot_topology', {})
        cache_timeout = plugin_cfg.get('cache_timeout', 300)
        cache_key = "nautobot_topology_global_view"

        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)

        # Fetch sites, using annotate to get device counts in a single query
        # and select_related to get parent locations (Region/Country) efficiently.
        sites = Location.objects.filter(
            location_type__name__icontains="site"
        ).select_related('parent').annotate(
            device_count=Count('devices')
        )
        
        sites_data = []

        for site in sites:
            # Safely get coordinates, using defaults if they don't exist securely 
            # (Nautobot's model fields can vary slightly by version, but latitude/longitude are standard).
            lat = float(site.latitude) if getattr(site, 'latitude', None) else None
            lng = float(site.longitude) if getattr(site, 'longitude', None) else None
            
            # If a site has no coordinates, we might skip it or assign mock ones for demonstration
            # but ideally we only show sites with coordinates.
            if lat is None or lng is None:
                continue

            # Use the annotated count instead of a separate query per site
            device_count = getattr(site, 'device_count', 0)
            
            # Simple link count mock (real link count would require cross-site cable logic)
            link_count = random.randint(1, 10)

            parent_name = site.parent.name if site.parent else "Global"
            
            sites_data.append({
                "id": str(site.id),
                "name": site.name,
                "coordinates": [lng, lat],
                "deviceCount": device_count,
                "linkCount": link_count,
                "region": parent_name,
                "country": parent_name,
                "status": "Active"
            })

        response_data = {
            "status": "success",
            "data": {
                "nodes": sites_data,
                "links": []
            }
        }
        
        # Cache the successful response
        cache.set(cache_key, response_data, timeout=cache_timeout)
        
        return Response(response_data)

    def retrieve(self, request, pk=None):
        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)

        # Gather all devices including those in sub-locations (recursive)
        locations = get_locations_for_site(site)
        devices = Device.objects.filter(location__in=locations).select_related(
            'role', 'primary_ip4', 'primary_ip6', 'platform', 'device_type__manufacturer', 'status'
        ).prefetch_related(
            'interfaces__ip_addresses', 
            'interfaces__untagged_vlan', 
            'interfaces__tagged_vlans'
        )
        
        nodes = []
        device_ids = set()
        available_vlans = set()
        available_prefixes = set()

        for device in devices:
            device_ids.add(device.id)
            
            primary_ip = ""
            if device.primary_ip4:
                primary_ip = str(device.primary_ip4.address.ip)
            elif device.primary_ip6:
                primary_ip = str(device.primary_ip6.address.ip)

            # Retrieve VLANs and Prefixes specific to this device's interfaces
            device_vlans = set()
            device_prefixes = set()
            
            # Accessing prefetched interfaces
            for interface in device.interfaces.all():
                if interface.untagged_vlan:
                    vlan_str = f"{interface.untagged_vlan.vid} - {interface.untagged_vlan.name}"
                    device_vlans.add(vlan_str)
                    available_vlans.add(vlan_str)
                for vlan in interface.tagged_vlans.all():
                    vlan_str = f"{vlan.vid} - {vlan.name}"
                    device_vlans.add(vlan_str)
                    available_vlans.add(vlan_str)
                
                for ip in interface.ip_addresses.all():
                    prefix_str = str(ip.address.cidr)
                    device_prefixes.add(prefix_str)
                    available_prefixes.add(prefix_str)

            nodes.append({
                "id": str(device.id),
                "name": device.name,
                "siteId": str(site.id),
                "role": getattr(device.role, 'name', "Unknown") if getattr(device, 'role', None) else "Unknown",
                "platform": getattr(device.platform, 'name', "Unknown") if hasattr(device, 'platform') else "Unknown",
                "vendor": getattr(device.device_type.manufacturer, 'name', "Unknown") if getattr(device, 'device_type', None) else "Unknown",
                "status": "active" if getattr(device.status, 'name', '') == 'Active' else "offline",
                "primaryIp": primary_ip,
                "vlans": list(device_vlans),
                "protocols": [], 
                "prefixes": list(device_prefixes), 
                "nautobotUrl": device.get_absolute_url()
            })

        links = []
        cables = Cable.objects.filter(
            _termination_a_device_id__in=device_ids, 
            _termination_b_device_id__in=device_ids
        ).select_related(
            '_termination_a_device',
            '_termination_b_device'
        )
        
        for cable in cables:
            term_a = cable.termination_a
            term_b = cable.termination_b
            # _termination_a_device and _termination_b_device are now prefetched.
            # termination_a.device will use the prefetched _termination_a_device in Nautobot 2.0+.
            links.append({
                "id": str(cable.id),
                "source": str(cable._termination_a_device_id),
                "target": str(cable._termination_b_device_id),
                "type": "physical",
                "sourceInterface": term_a.name if term_a else "Unknown",
                "targetInterface": term_b.name if term_b else "Unknown",
                "nautobotUrl": cable.get_absolute_url()
            })

        # Aggregate all VLANs and Prefixes assigned to this site and its descendants
        site_vlans = VLAN.objects.filter(location__in=locations)
        site_prefixes = Prefix.objects.filter(location__in=locations)
        
        for vlan in site_vlans:
            vlan_str = f"{vlan.vid} - {vlan.name}"
            available_vlans.add(vlan_str)
            
        for prefix in site_prefixes:
            available_prefixes.add(str(prefix))

        # Get plugin configuration
        plugin_config = settings.PLUGINS_CONFIG.get('nautobot_topology', {})
        topology_style = plugin_config.get('topology_style', 'fancy')
        prometheus_enabled = plugin_config.get('prometheus_enabled', False)

        return Response({
            "status": "success",
            "data": {
                "nodes": nodes,
                "links": links,
                "availableVlans": sorted(list(available_vlans)),
                "availablePrefixes": sorted(list(available_prefixes)),
                "config": {
                    "topology_style": topology_style,
                    "prometheus_enabled": prometheus_enabled
                }
            }
        })

    @action(detail=True, methods=['get'])
    def metrics(self, request, pk=None):
        """Return per‑link traffic metrics for a site.
        The endpoint is optional – it only works if the plugin's Prometheus
        integration is enabled via ``settings.PLUGINS_CONFIG['nautobot_topology']``.
        It queries the Prometheus server defined in the plugin settings and
        returns a mapping of link IDs to ``tx``, ``rx`` (bits per second) and a
        simple ``utilization`` percentage (assuming a 1 Gbps link capacity).
        """
        from django.conf import settings
        import requests

        # Load plugin configuration – fall back to defaults if missing
        plugin_cfg = getattr(settings, 'PLUGINS_CONFIG', {}).get('nautobot_topology', {})
        if not plugin_cfg.get('prometheus_enabled', False):
            return Response({"status": "success", "data": {"metrics": {}}})

        prometheus_url = plugin_cfg.get('prometheus_url', 'http://prometheus:9090')
        query_tx_tpl = plugin_cfg.get('prometheus_query_tx')
        query_rx_tpl = plugin_cfg.get('prometheus_query_rx')

        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)

        # Gather all devices including those in sub-locations (recursive)
        locations = get_locations_for_site(site)
        devices = Device.objects.filter(location__in=locations)
        device_ids = list(devices.values_list('id', flat=True))
        
        # Gather all cables that connect devices within this site (and sub-locations)
        cables = Cable.objects.filter(_termination_a_device_id__in=device_ids,
                                    _termination_b_device_id__in=device_ids).select_related(
                                        '_termination_a_device',
                                        '_termination_b_device'
                                    )

        metrics = {}
        # Assume a 1 Gbps capacity for utilization calculation (adjustable later)
        capacity_bps = 1_000_000_000

        for cable in cables:
            # Resolve interface names – fall back to empty strings if missing
            term_a = cable.termination_a
            term_b = cable.termination_b
            if not (hasattr(term_a, 'device') and hasattr(term_b, 'device')):
                continue
            dev_a = term_a.device.name
            dev_b = term_b.device.name
            iface_a = term_a.name
            iface_b = term_b.name

            # Check for mock mode
            if prometheus_url == "mock":
                import random
                tx_rate = random.uniform(10_000, 800_000_000)
                rx_rate = random.uniform(10_000, 800_000_000)
                utilization = ((tx_rate + rx_rate) / capacity_bps) * 100.0
            else:
                # Build PromQL queries for both directions (A→B and B→A)
                tx_query = query_tx_tpl.format(device=dev_a, interface=iface_a)
                rx_query = query_rx_tpl.format(device=dev_b, interface=iface_b)

                # Helper to perform a single query
                def query_prometheus(q):
                    try:
                        resp = requests.get(f"{prometheus_url}/api/v1/query", params={"query": q}, timeout=5)
                        resp.raise_for_status()
                        data = resp.json()
                        if data.get('status') == 'success' and data.get('data', {}).get('result'):
                            # Take the first series and the latest value
                            value = float(data['data']['result'][0]['value'][1])
                            return value
                    except Exception:
                        return None
                    return None

                tx_rate = query_prometheus(tx_query) or 0.0
                rx_rate = query_prometheus(rx_query) or 0.0
                utilization = min(100.0, ((tx_rate + rx_rate) / capacity_bps) * 100.0)

            metrics[str(cable.id)] = {
                "tx": tx_rate,
                "rx": rx_rate,
                "utilization": utilization,
            }

        return Response({"status": "success", "data": {"metrics": metrics}})

        # (intentionally blank, removing duplicate block)
