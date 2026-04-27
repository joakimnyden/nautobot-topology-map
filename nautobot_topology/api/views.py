from django.conf import settings
from django.db.models import Count
from django.core.cache import cache
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from nautobot.dcim.models import Device, Location, Cable
from nautobot.ipam.models import VLAN, Prefix
from .serializers import DeviceSerializer
from .discovery import discover_neighbors
from nautobot.extras.models import Status

from nautobot.core.api.views import ModelViewSet
from rest_framework.permissions import BasePermission

def get_locations_for_site(site):
    """Get all descendant locations including self using Nautobot's native tree manager."""
    # Convert to list of IDs to avoid CTE issues in subqueries (Postgres/Nautobot 2.x)
    return list(site.descendants(include_self=True).values_list('id', flat=True))

class TopologyPermission(BasePermission):
    """Custom permission class for Topology Map."""
    def has_permission(self, request, view):
        if request.user and request.user.is_superuser:
            return True
        
        # Check specific actions for discovery
        if view.action in ["discover_cables", "import_cables"]:
            return request.user.has_perm("nautobot_topology.run_cablediscovery")

        if request.method == "GET":
            return request.user.has_perm("nautobot_topology.view_topologylayout")
        return request.user.has_perm("nautobot_topology.change_topologylayout")

class TopologyViewSet(ViewSet):
    permission_classes = [TopologyPermission]
    queryset = Location.objects.filter(location_type__name="Site")
    def list(self, request):
        import random
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
            # Recursive location lookup for accurate counts
            descendant_location_ids = list(site.descendants(include_self=True).values_list('id', flat=True))
            
            # Count devices in this site and all sub-locations (Floors, Racks, etc)
            actual_device_count = Device.objects.filter(location_id__in=descendant_location_ids).count()
            
            # Count internal cables within this site's hierarchy
            # Using id comparison for speed
            site_device_ids = Device.objects.filter(location_id__in=descendant_location_ids).values_list('id', flat=True)
            actual_link_count = Cable.objects.filter(
                _termination_a_device_id__in=site_device_ids,
                _termination_b_device_id__in=site_device_ids
            ).count()
            # Safely get coordinates
            lat = float(site.latitude) if getattr(site, 'latitude', None) else None
            lng = float(site.longitude) if getattr(site, 'longitude', None) else None
            
            if lat is None or lng is None:
                continue
            parent_name = site.parent.name if site.parent else "Global"
            
            sites_data.append({
                "id": str(site.id),
                "name": site.name,
                "coordinates": [lng, lat],
                "deviceCount": actual_device_count,
                "linkCount": actual_link_count,
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
        # Get plugin configuration
        plugin_config = settings.PLUGINS_CONFIG.get('nautobot_topology', {})
        allowed_statuses = plugin_config.get('allowed_statuses', ['Active'])
        allowed_device_types = plugin_config.get('allowed_device_types', [])
        topology_style = plugin_config.get('topology_style', 'fancy')
        prometheus_enabled = plugin_config.get('prometheus_enabled', False)
        ap_role_name = plugin_config.get('ap_role_name', 'Access Points')
        # Gather all devices including those in sub-locations (recursive)
        locations = get_locations_for_site(site)
        devices_qs = Device.objects.filter(location__in=locations)
        
        # Apply configurable filters early
        if allowed_statuses:
            devices_qs = devices_qs.filter(status__name__in=allowed_statuses)
        if allowed_device_types:
            devices_qs = devices_qs.filter(device_type__model__in=allowed_device_types)
        # Prefetch necessary data for serialization (minimal for topology)
        devices_qs = devices_qs.select_related(
            'role', 'primary_ip4', 'primary_ip6', 'platform', 'device_type__manufacturer', 'status', 'location'
        )
        devices = list(devices_qs)
        device_ids = [str(d.id) for d in devices]
                
        # 1. Fetch Interface data with LAG and Names
        from nautobot.dcim.models import Interface, FrontPort
        iface_data = Interface.objects.filter(device__in=devices).values(
            'id', 'device_id', 'device__name', 'name', 'lag_id', 'lag__name', 'type', 'speed'
        )
        term_to_data = {str(i['id']): i for i in iface_data}
        
        # Add FrontPorts too
        fp_data = FrontPort.objects.filter(device__in=devices).values('id', 'device_id', 'device__name', 'name', 'type')
        for fp in fp_data:
            term_to_data[str(fp['id'])] = {
                'device_id': fp['device_id'], 
                'device__name': fp['device__name'], 
                'name': fp['name'], 
                'type': fp['type'],
                'speed': None, 
                'lag_id': None, 
                'lag__name': None
            }
        all_term_ids = list(term_to_data.keys())
        # 2. Process Cables with LAG Aggregation
        cables = Cable.objects.filter(
            termination_a_id__in=all_term_ids,
            termination_b_id__in=all_term_ids
        ).values('id', 'termination_a_id', 'termination_b_id', 'label', 'type')
        
        links_map = []
        lag_links = {} # (s_dev, t_dev, s_lag) -> link_obj
        connected_device_ids = set()
        
        for cable in cables:
            s_tid = str(cable['termination_a_id'])
            t_tid = str(cable['termination_b_id'])
            s_data = term_to_data.get(s_tid)
            t_data = term_to_data.get(t_tid)
            
            if s_data and t_data:
                s_dev, t_dev = str(s_data['device_id']), str(t_data['device_id'])
                connected_device_ids.add(s_dev)
                connected_device_ids.add(t_dev)
                
                # Check for LAG
                s_lag = s_data['lag_id']
                if s_lag:
                    dev_pair = sorted([s_dev, t_dev])
                    pairing = (dev_pair[0], dev_pair[1], str(s_lag))
                    if pairing not in lag_links:
                        lag_links[pairing] = {
                            "id": f"lag-{s_lag}",
                            "source": s_dev,
                            "target": t_dev,
                            "sourceDeviceName": s_data['device__name'],
                            "targetDeviceName": t_data['device__name'],
                            "type": "port-channel",
                            "isPortChannel": True,
                            "sourceInterface": s_data['lag__name'],
                            "sourceInterfaceUrl": f"/dcim/interfaces/{s_lag}/",
                            "targetInterface": t_data['lag__name'] if t_data.get('lag_id') else "LAG",
                            "targetInterfaceUrl": f"/dcim/interfaces/{t_data['lag_id']}/" if t_data.get('lag_id') else None,
                            "lagMembers": [],
                            "nautobotUrl": f"/dcim/interfaces/{s_lag}/"
                        }
                    # Add member pair with IDs for linking
                    lag_links[pairing]["lagMembers"].append({
                        "sourceInterface": s_data['name'],
                        "sourceInterfaceId": str(s_data['id']),
                        "targetInterface": t_data['name'],
                        "targetInterfaceId": str(t_data['id'])
                    })
                else:
                    links_map.append({
                        "id": str(cable['id']),
                        "source": s_dev,
                        "target": t_dev,
                        "sourceDeviceName": s_data['device__name'],
                        "targetDeviceName": t_data['device__name'],
                        "type": "physical",
                        "sourceInterface": s_data['name'],
                        "targetInterface": t_data['name'],
                        "sourceInterfaceType": s_data['type'],
                        "targetInterfaceType": t_data['type'],
                        "speed": s_data['speed'],
                        "nautobotUrl": f"/dcim/cables/{cable['id']}/"
                    })
        
        # Add aggregated LAG links
        links_map.extend(lag_links.values())
        # 3. Discover BGP Peerings from BGP Plugin
        try:
            from nautobot_bgp_models.models import Peering
            peerings = Peering.objects.filter(
                endpoints__routing_instance__device__in=devices
            ).distinct().prefetch_related('endpoints__routing_instance__device')
            
            for peering in peerings:
                eps = list(peering.endpoints.all())
                if len(eps) >= 2:
                    source_dev = str(eps[0].routing_instance.device_id)
                    target_dev = str(eps[1].routing_instance.device_id)
                    connected_device_ids.add(source_dev)
                    connected_device_ids.add(target_dev)
                    links_map.append({
                        "id": f"bgp-{peering.id}",
                        "source": source_dev,
                        "target": target_dev,
                        "type": "logical",
                        "protocol": "BGP",
                        "status": getattr(peering.status, "name", "Unknown") if getattr(peering, "status", None) else "Unknown",
                        "description": getattr(peering, "description", "") or "",
                        "localAs": str(getattr(getattr(eps[0], 'autonomous_system', None), 'asn', '')) if len(eps) > 0 and getattr(eps[0], 'autonomous_system', None) else None,
                        "remoteAs": str(getattr(getattr(eps[1], 'autonomous_system', None), 'asn', '')) if len(eps) > 1 and getattr(eps[1], 'autonomous_system', None) else None,
                        "localIp": str(eps[0].source_ip.address.ip) if len(eps) > 0 and getattr(eps[0], 'source_ip', None) else None,
                        "remoteIp": str(eps[1].source_ip.address.ip) if len(eps) > 1 and getattr(eps[1], 'source_ip', None) else None,
                        "peerGroup": getattr(peering.peer_group, 'name', None) if getattr(peering, 'peer_group', None) else None,
                        "nautobotUrl": peering.get_absolute_url() if hasattr(peering, 'get_absolute_url') else f"/plugins/nautobot-bgp-models/peerings/{peering.id}/"
                    })
        except Exception as e:
            if plugin_config.get('debug'):
                print(f"BGP discovery skipped: {e}")
        nodes = []
        available_vlans = set()
        available_prefixes = set()
        
        # 2. Separate devices into connected and unconnected
        unconnected_by_location = {} # location_id -> [devices]
        
        for device in devices:
            dev_id = str(device.id)
            
            # Optimization: Skip individual VLAN/Prefix processing for large site views
            # This data can be fetched via a detail endpoint if needed.
            device_vlans = []
            device_prefixes = []
            if dev_id in connected_device_ids:
                # Add individual node for connected device
                primary_ip = ""
                if device.primary_ip4:
                    primary_ip = str(device.primary_ip4.address.ip)
                elif device.primary_ip6:
                    primary_ip = str(device.primary_ip6.address.ip)
                nodes.append({
                    "id": dev_id,
                    "name": device.name,
                    "siteId": str(site.id),
                    "role": getattr(device.role, 'name', "Unknown"),
                    "platform": getattr(device.platform, 'name', "Unknown"),
                    "deviceType": getattr(device.device_type, 'model', "Unknown"),
                    "vendor": getattr(device.device_type.manufacturer, 'name', "Unknown"),
                    "status": "active" if getattr(device.status, 'name', '') == 'Active' else "offline",
                    "primaryIp": primary_ip,
                    "vlans": list(set(device_vlans)),
                    "protocols": [], 
                    "prefixes": list(set(device_prefixes)), 
                    "nautobotUrl": device.get_absolute_url()
                })
            else:
                # Group unconnected devices by location AND whether they are APs
                ap_role_name = plugin_config.get('ap_role_name', 'Access Points')
                role_name = str(getattr(device.role, "name", "") or "")
                # Exact match or case-insensitive match for the configured role
                is_ap = role_name.lower() == ap_role_name.lower()
                # Fallback for common naming if using default
                if ap_role_name.lower() == "access points" and not is_ap:
                    is_ap = role_name.lower() == "access point"
                
                loc_id = str(device.location_id)
                group_key = f"{loc_id}-ap" if is_ap else f"{loc_id}-other"
                
                if group_key not in unconnected_by_location:
                    unconnected_by_location[group_key] = []
                unconnected_by_location[group_key].append(device)
        # 3. Create aggregated nodes for unconnected devices
        for loc_id, group_devices in unconnected_by_location.items():
            if not group_devices:
                continue
            
            loc_obj = group_devices[0].location
            is_ap_group = loc_id.endswith("-ap")
            
            if len(group_devices) > 1:
                # Aggregate into a "Group" node
                group_name = f"{loc_obj.name} ({ap_role_name})" if is_ap_group else f"{loc_obj.name} (Other)"
                
                # Collect basic metadata about the devices within this group
                inner_devices = []
                for d in group_devices:
                    ip_str = ""
                    if d.primary_ip4:
                        ip_str = str(d.primary_ip4.address.ip)
                    elif d.primary_ip6:
                        ip_str = str(d.primary_ip6.address.ip)
                    inner_devices.append({
                        "id": str(d.id),
                        "name": d.name,
                        "role": getattr(d.role, 'name', "Unknown"),
                        "primaryIp": ip_str,
                        "nautobotUrl": d.get_absolute_url()
                    })
                
                nodes.append({
                    "id": f"group-{loc_id}",
                    "name": group_name,
                    "siteId": str(site.id),
                    "role": ap_role_name if is_ap_group else "Other",
                    "type": "group",
                    "deviceCount": len(group_devices),
                    "devices": inner_devices,
                    "status": "active",
                    "vendor": "Nautobot",
                    "description": f"Collection of {len(group_devices)} unconnected {'AP' if is_ap_group else 'device'}s in {loc_obj.name}"
                })
            else:
                # Single unconnected device, show it as individual node but maybe it's cleaner as single?
                # User said "sum them up if they aren't connected"
                device = group_devices[0]
                primary_ip = ""
                if device.primary_ip4:
                    primary_ip = str(device.primary_ip4.address.ip)
                elif device.primary_ip6:
                    primary_ip = str(device.primary_ip6.address.ip)
                
                nodes.append({
                    "id": str(device.id),
                    "name": device.name,
                    "siteId": str(site.id),
                    "role": getattr(device.role, 'name', "Unknown"),
                    "type": "device",
                    "status": "active" if getattr(device.status, 'name', '') == 'Active' else "offline",
                    "primaryIp": primary_ip,
                    "nautobotUrl": device.get_absolute_url()
                })
        # Efficient site-wide VLAN/Prefix aggregation for sidebar
        descendant_vlan_ids = VLAN.objects.filter(location__in=locations).values_list('vid', 'name')
        for vid, name in descendant_vlan_ids:
            available_vlans.add(f"{vid} - {name}")
            
        descendant_prefixes = Prefix.objects.filter(location__in=locations).values_list('network', 'prefix_length')
        for network, length in descendant_prefixes:
            available_prefixes.add(f"{network}/{length}")
        return Response({
            "status": "success",
            "data": {
                "nodes": nodes,
                "links": links_map,
                "availableVlans": sorted(list(available_vlans)),
                "availablePrefixes": sorted(list(available_prefixes)),
                "config": {
                    "topology_style": topology_style,
                    "prometheus_enabled": prometheus_enabled,
                    "ap_role_name": ap_role_name,
                "debug": plugin_config.get('debug', False)
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
        location_ids = get_locations_for_site(site)
        devices = Device.objects.filter(location_id__in=location_ids)
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
    @action(detail=True, methods=['get', 'post'])
    def layout(self, request, pk=None):
        """Get or save the layout positions for nodes in a site."""
        from ..models import TopologyLayout
        
        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)

        if request.method == 'POST':
            # Store the raw layout dictionary (e.g. { "node_id": { "x": 1, "y": 2 }, ... })
            layout_data = request.data
            TopologyLayout.objects.update_or_create(
                site=site,
                defaults={'layout_data': layout_data}
            )
            return Response({"status": "success", "message": "Layout saved"})
            
        try:
            layout_obj = TopologyLayout.objects.get(site=site)
            layout_data = layout_obj.layout_data
        except TopologyLayout.DoesNotExist:
            layout_data = {"nodes": []}
            
        return Response({"status": "success", "data": layout_data})

    @action(detail=True, methods=['get'])
    def discover_cables(self, request, pk=None):
        """Discover CDP/LLDP neighbors for a specific device."""
        try:
            device = Device.objects.get(pk=pk)
        except Device.DoesNotExist:
            return Response({"status": "error", "message": "Device not found"}, status=404)
            
        try:
            results = discover_neighbors(device.id)
            return Response({"status": "success", "data": results})
        except Exception as e:
            return Response({"status": "error", "message": str(e)}, status=500)

    @action(detail=True, methods=['get'])
    def devices(self, request, pk=None):
        """Return all devices in a site and its sub-locations recursively."""
        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)
            
        locations = get_locations_for_site(site)
        devices = Device.objects.filter(location__in=locations).select_related(
            'role', 'primary_ip4', 'primary_ip6', 'status', 'location'
        )
        
        # Serialize simply for discovery
        data = []
        for d in devices:
            primary_ip = ""
            if d.primary_ip4:
                primary_ip = str(d.primary_ip4.address.ip)
            elif d.primary_ip6:
                primary_ip = str(d.primary_ip6.address.ip)
                
            data.append({
                "id": str(d.id),
                "name": d.name,
                "role": {"name": getattr(d.role, 'name', "Unknown")},
                "status": {"name": getattr(d.status, 'name', "Unknown")},
                "primary_ip4": {"display": primary_ip, "address": primary_ip} if primary_ip else None,
                "location": {"name": d.location.name, "display": d.location.display}
            })
            
        return Response({"status": "success", "results": data})

    @action(detail=False, methods=['post'])
    def import_cables(self, request):
        """Import accepted cables into Nautobot."""
        cables_data = request.data.get('cables', [])
        created_cables = []
        errors = []
        
        try:
            active_status = Status.objects.get(name='Connected')
        except Status.DoesNotExist:
            active_status = Status.objects.filter(content_types__model='cable').first()
            
        for cable_spec in cables_data:
            term_a_id = cable_spec.get('local_interface_id')
            term_b_id = cable_spec.get('remote_interface_id')
            
            if not term_a_id or not term_b_id:
                errors.append(f"Missing interface ID for {cable_spec}")
                continue
                
            try:
                from nautobot.dcim.models import Interface, FrontPort, RearPort, ConsolePort, ConsoleServerPort
                
                # Model mapping
                model_map = {
                    'interface': Interface,
                    'frontport': FrontPort,
                    'rearport': RearPort,
                    'consoleport': ConsolePort,
                    'consoleserverport': ConsoleServerPort
                }
                
                local_type = cable_spec.get('local_interface_type', 'interface')
                remote_type = cable_spec.get('remote_interface_type', 'interface')
                
                model_a = model_map.get(local_type, Interface)
                model_b = model_map.get(remote_type, Interface)
                
                term_a = model_a.objects.get(id=term_a_id)
                term_b = model_b.objects.get(id=term_b_id)
                
                if term_a.cable or term_b.cable:
                    errors.append(f"Interface already has a cable: {term_a.name} or {term_b.name}")
                    continue
                    
                cable = Cable(
                    termination_a=term_a,
                    termination_b=term_b,
                    type=cable_spec.get('type', 'cat6a'),
                    status=active_status
                )
                cable.validated_save()
                created_cables.append(str(cable.id))
            except Exception as e:
                errors.append(f"Error creating cable between {term_a_id} and {term_b_id}: {str(e)}")
                
        return Response({
            "status": "success" if not errors else "partial",
            "created": len(created_cables),
            "errors": errors
        })
