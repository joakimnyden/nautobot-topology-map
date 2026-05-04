from django.conf import settings
from django.db.models import Count
from django.core.cache import cache
import random
import requests
from rest_framework.viewsets import ViewSet
from rest_framework.decorators import action
from rest_framework.response import Response
from nautobot.dcim.models import Device, Location, Cable, Interface, FrontPort, RearPort, ConsolePort, ConsoleServerPort
from nautobot.ipam.models import VLAN, Prefix
from nautobot.extras.models import Status
from rest_framework.permissions import BasePermission
from .discovery import discover_neighbors
from ..models import TopologyLayout


def get_locations_for_site(site):
    """Get all descendant locations including self using Nautobot's native tree manager."""
    # Convert to list of IDs to avoid CTE issues in subqueries (Postgres/Nautobot 2.x)
    return list(site.descendants(include_self=True).values_list("id", flat=True))


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

        # Load plugin configuration
        plugin_cfg = getattr(settings, "PLUGINS_CONFIG", {}).get("nautobot_topology", {})
        cache_timeout = plugin_cfg.get("cache_timeout", 300)
        cache_key = "nautobot_topology_global_view"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response(cached_data)
        # Fetch sites, using annotate to get device counts in a single query
        # and select_related to get parent locations (Region/Country) efficiently.
        sites = (
            Location.objects.filter(location_type__name__icontains="site", devices__isnull=False)
            .distinct()
            .select_related("parent")
            .annotate(device_count=Count("devices"))
        )

        sites_data = []
        for site in sites:
            # Recursive location lookup for accurate counts
            descendant_location_ids = list(site.descendants(include_self=True).values_list("id", flat=True))

            # Count devices in this site and all sub-locations (Floors, Racks, etc)
            actual_device_count = Device.objects.filter(location_id__in=descendant_location_ids).count()

            # Count internal cables within this site's hierarchy
            # Using id comparison for speed
            site_device_ids = Device.objects.filter(location_id__in=descendant_location_ids).values_list(
                "id", flat=True
            )
            actual_link_count = Cable.objects.filter(
                _termination_a_device_id__in=site_device_ids,
                _termination_b_device_id__in=site_device_ids,
            ).count()
            # Safely get coordinates
            lat = float(site.latitude) if getattr(site, "latitude", None) else None
            lng = float(site.longitude) if getattr(site, "longitude", None) else None

            if lat is None or lng is None:
                continue
            parent_name = site.parent.name if site.parent else "Global"

            sites_data.append(
                {
                    "id": str(site.id),
                    "name": site.name,
                    "coordinates": [lng, lat],
                    "deviceCount": actual_device_count,
                    "linkCount": actual_link_count,
                    "region": parent_name,
                    "country": parent_name,
                    "status": "Active",
                }
            )
        response_data = {
            "status": "success",
            "data": {"nodes": sites_data, "links": []},
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
        plugin_config = settings.PLUGINS_CONFIG.get("nautobot_topology", {})
        locations = get_locations_for_site(site)

        # 1. Fetch devices and categorize them
        devices_qs = self._get_filtered_devices_queryset(locations, plugin_config)
        devices = list(devices_qs)

        # 2. Get interfaces and ports for cable lookup
        term_to_data = self._get_term_to_data_map(devices)

        # 3. Process Links
        links_map, connected_device_ids = self._get_cable_links(term_to_data)

        # 4. Add BGP Peerings
        links_map.extend(self._get_bgp_links(devices, connected_device_ids))

        # 5. Build Nodes (Connected + Aggregated Unconnected)
        nodes = self._build_topology_nodes(site, devices, connected_device_ids, links_map, plugin_config)

        # 6. Site-wide aggregation for sidebar
        vlans = self._get_site_vlans(locations)
        prefixes = self._get_site_prefixes(locations)

        return Response(
            {
                "status": "success",
                "data": {
                    "nodes": nodes,
                    "links": links_map,
                    "availableVlans": vlans,
                    "availablePrefixes": prefixes,
                    "config": {
                        "topology_style": plugin_config.get("topology_style", "fancy"),
                        "prometheus_enabled": plugin_config.get("prometheus_enabled", False),
                        "ap_role_name": plugin_config.get("ap_role_name", "Access Points"),
                        "debug": plugin_config.get("debug", False),
                    },
                },
            }
        )

    def _get_filtered_devices_queryset(self, locations, plugin_config):
        """Build a filtered and optimized device queryset."""
        allowed_statuses = plugin_config.get("allowed_statuses", ["Active"])
        allowed_device_types = plugin_config.get("allowed_device_types", [])

        devices_qs = Device.objects.filter(location__in=locations)

        if allowed_statuses:
            devices_qs = devices_qs.filter(status__name__in=allowed_statuses)
        if allowed_device_types:
            devices_qs = devices_qs.filter(device_type__model__in=allowed_device_types)

        return devices_qs.select_related(
            "role",
            "primary_ip4",
            "primary_ip6",
            "platform",
            "device_type__manufacturer",
            "status",
            "location",
        )

    def _get_term_to_data_map(self, devices):
        """Map all termination IDs to their metadata for link processing."""
        term_to_data = {}

        # Fetch Interfaces
        iface_data = Interface.objects.filter(device__in=devices).values(
            "id", "device_id", "device__name", "name", "lag_id", "lag__name", "type", "speed"
        )
        for i in iface_data:
            term_to_data[str(i["id"])] = i

        # Fetch FrontPorts
        fp_data = FrontPort.objects.filter(device__in=devices).values("id", "device_id", "device__name", "name", "type")
        for fp in fp_data:
            term_to_data[str(fp["id"])] = {
                "device_id": fp["device_id"],
                "device__name": fp["device__name"],
                "name": fp["name"],
                "type": fp["type"],
                "speed": None,
                "lag_id": None,
                "lag__name": None,
            }

        return term_to_data

    def _get_cable_links(self, term_to_data):
        """Generate cable links and identify connected devices."""
        all_term_ids = list(term_to_data.keys())
        cables = Cable.objects.filter(termination_a_id__in=all_term_ids, termination_b_id__in=all_term_ids).values(
            "id", "termination_a_id", "termination_b_id", "label", "type"
        )

        links = []
        lag_links = {}
        connected_device_ids = set()

        for cable in cables:
            s_tid, t_tid = str(cable["termination_a_id"]), str(cable["termination_b_id"])
            s_data, t_data = term_to_data.get(s_tid), term_to_data.get(t_tid)

            if s_data and t_data:
                s_dev, t_dev = str(s_data["device_id"]), str(t_data["device_id"])
                connected_device_ids.add(s_dev)
                connected_device_ids.add(t_dev)

                s_lag = s_data["lag_id"]
                if s_lag:
                    dev_pair = sorted([s_dev, t_dev])
                    pairing = (dev_pair[0], dev_pair[1], str(s_lag))
                    if pairing not in lag_links:
                        lag_links[pairing] = self._init_lag_link(s_dev, t_dev, s_lag, s_data, t_data)

                    lag_links[pairing]["lagMembers"].append(
                        {
                            "sourceInterface": s_data["name"],
                            "sourceInterfaceId": str(s_data["id"]),
                            "targetInterface": t_data["name"],
                            "targetInterfaceId": str(t_data["id"]),
                        }
                    )
                else:
                    links.append(
                        {
                            "id": str(cable["id"]),
                            "source": s_dev,
                            "target": t_dev,
                            "sourceDeviceName": s_data["device__name"],
                            "targetDeviceName": t_data["device__name"],
                            "type": "physical",
                            "sourceInterface": s_data["name"],
                            "targetInterface": t_data["name"],
                            "sourceInterfaceType": s_data["type"],
                            "targetInterfaceType": t_data["type"],
                            "speed": s_data["speed"],
                            "nautobotUrl": f"/dcim/cables/{cable['id']}/",
                        }
                    )

        links.extend(lag_links.values())
        return links, connected_device_ids

    def _init_lag_link(self, s_dev, t_dev, s_lag, s_data, t_data):
        """Initialize a LAG aggregation link object."""
        return {
            "id": f"lag-{s_lag}",
            "source": s_dev,
            "target": t_dev,
            "sourceDeviceName": s_data["device__name"],
            "targetDeviceName": t_data["device__name"],
            "type": "port-channel",
            "isPortChannel": True,
            "sourceInterface": s_data["lag__name"],
            "sourceInterfaceUrl": f"/dcim/interfaces/{s_lag}/",
            "targetInterface": (t_data["lag__name"] if t_data.get("lag_id") else "LAG"),
            "targetInterfaceUrl": (f"/dcim/interfaces/{t_data['lag_id']}/" if t_data.get("lag_id") else None),
            "lagMembers": [],
            "nautobotUrl": f"/dcim/interfaces/{s_lag}/",
        }

    def _get_bgp_links(self, devices, connected_device_ids):
        """Fetch and format BGP peerings as logical links."""
        links = []
        try:
            from nautobot_bgp_models.models import Peering

            peerings = (
                Peering.objects.filter(endpoints__routing_instance__device__in=devices)
                .distinct()
                .prefetch_related("endpoints__routing_instance__device", "endpoints__autonomous_system", "status")
            )

            for peering in peerings:
                eps = list(peering.endpoints.all())
                if len(eps) >= 2:
                    s_dev, t_dev = str(eps[0].routing_instance.device_id), str(eps[1].routing_instance.device_id)
                    connected_device_ids.add(s_dev)
                    connected_device_ids.add(t_dev)
                    links.append(self._format_bgp_link(peering, eps, s_dev, t_dev))
        except (ImportError, Exception):
            pass
        return links

    def _format_bgp_link(self, peering, eps, s_dev, t_dev):
        """Format a BGP peering into a topology link object."""
        return {
            "id": f"bgp-{peering.id}",
            "source": s_dev,
            "target": t_dev,
            "type": "logical",
            "protocol": "BGP",
            "status": getattr(peering.status, "name", "Unknown") if peering.status else "Unknown",
            "description": peering.description or "",
            "localAs": str(eps[0].autonomous_system.asn) if eps[0].autonomous_system else None,
            "remoteAs": str(eps[1].autonomous_system.asn) if eps[1].autonomous_system else None,
            "localIp": str(eps[0].source_ip.address.ip) if eps[0].source_ip else None,
            "remoteIp": str(eps[1].source_ip.address.ip) if eps[1].source_ip else None,
            "peerGroup": getattr(peering.peer_group, "name", None),
            "nautobotUrl": (
                peering.get_absolute_url()
                if hasattr(peering, "get_absolute_url")
                else f"/plugins/nautobot-bgp-models/peerings/{peering.id}/"
            ),
        }

    def _build_topology_nodes(self, site, devices, connected_device_ids, links_map, plugin_config):
        """Build the list of nodes, grouping unconnected devices or leaf APs where applicable."""
        nodes = []
        ap_role_name = plugin_config.get("ap_role_name", "Access Points")

        # 1. Identify APs and their connections
        ap_ids = set()
        for device in devices:
            role_name = str(getattr(device.role, "name", "") or "")
            if role_name.lower() in [ap_role_name.lower(), "access point", "ap"]:
                ap_ids.add(str(device.id))

        # Map devices to their neighbors (only considering physical/logical links in this site)
        device_neighbors = {}
        for link in links_map:
            # We only care about simple links for neighbor mapping
            if link.get("type") in ["physical", "logical", "bgp"]:
                s, t = link["source"], link["target"]
                if s not in device_neighbors:
                    device_neighbors[s] = []
                if t not in device_neighbors:
                    device_neighbors[t] = []
                device_neighbors[s].append(t)
                device_neighbors[t].append(s)

        # 2. Categorize devices: regular node, group member (AP), or unconnected group member
        groups = {}  # key -> list of devices
        links_to_remove = set()
        links_to_add = []

        processed_dev_ids = set()

        for device in devices:
            dev_id = str(device.id)
            is_ap = dev_id in ap_ids
            neighbors = device_neighbors.get(dev_id, [])

            # Logic for grouping APs by parent switch
            if is_ap and len(neighbors) == 1:
                parent_id = neighbors[0]
                group_key = f"ap-parent-{parent_id}-{device.location_id}"
                if group_key not in groups:
                    groups[group_key] = {"devices": [], "parent_id": parent_id, "type": "ap"}
                groups[group_key]["devices"].append(device)
                processed_dev_ids.add(dev_id)
                # Mark link for removal (we'll replace it with a group link)
                links_to_remove.add(dev_id)

            # Logic for unconnected devices (existing behavior)
            elif dev_id not in connected_device_ids:
                group_key = f"unconnected-{device.location_id}"
                if group_key not in groups:
                    groups[group_key] = {"devices": [], "parent_id": None, "type": "other"}
                groups[group_key]["devices"].append(device)
                processed_dev_ids.add(dev_id)

            else:
                # Regular connected device (not a leaf AP)
                nodes.append(self._format_device_node(site, device))

        # 3. Process groups and update links
        for group_key, group_info in groups.items():
            group_devices = group_info["devices"]
            parent_id = group_info["parent_id"]
            is_ap_group = group_info["type"] == "ap"

            if len(group_devices) > 1:
                # Create the group node
                group_id = f"group-{group_key}"
                nodes.append(self._format_group_node(site, group_devices, is_ap_group, ap_role_name, group_id))

                # If it has a parent, link the group node to the parent
                if parent_id:
                    links_to_add.append(
                        {
                            "id": f"link-to-{group_id}",
                            "source": parent_id,
                            "target": group_id,
                            "type": "physical",
                            "label": f"x{len(group_devices)} APs",
                        }
                    )
            else:
                # Only one device in group, show it as a regular node
                nodes.append(self._format_device_node(site, group_devices[0]))
                # Don't remove the link if it's not actually being grouped
                if group_devices[0].id in links_to_remove:
                    links_to_remove.remove(str(group_devices[0].id))

        # 4. Clean up links_map
        # Remove original links to grouped APs
        # We need to filter the original list
        i = len(links_map) - 1
        while i >= 0:
            link = links_map[i]
            s, t = link.get("source"), link.get("target")
            if s in links_to_remove or t in links_to_remove:
                links_map.pop(i)
            i -= 1

        links_map.extend(links_to_add)

        return nodes

    def _format_device_node(self, site, device):
        """Format a single device as a topology node."""
        primary_ip = ""
        if device.primary_ip4:
            primary_ip = str(device.primary_ip4.address.ip)
        elif device.primary_ip6:
            primary_ip = str(device.primary_ip6.address.ip)

        return {
            "id": str(device.id),
            "name": device.name,
            "siteId": str(site.id),
            "role": getattr(device.role, "name", "Unknown"),
            "platform": getattr(device.platform, "name", "Unknown"),
            "deviceType": getattr(device.device_type, "model", "Unknown"),
            "vendor": getattr(device.device_type.manufacturer, "name", "Unknown"),
            "status": "active" if getattr(device.status, "name", "") == "Active" else "offline",
            "primaryIp": primary_ip,
            "vlans": [],
            "protocols": [],
            "prefixes": [],
            "nautobotUrl": device.get_absolute_url(),
        }

    def _format_group_node(self, site, devices, is_ap_group, ap_role_name, node_id=None):
        """Format a group of devices as a single topology node."""
        loc_obj = devices[0].location
        group_name = f"{loc_obj.name} ({ap_role_name})" if is_ap_group else f"{loc_obj.name} (Other)"

        inner_devices = []
        for d in devices:
            ip_str = str(
                d.primary_ip4.address.ip if d.primary_ip4 else (d.primary_ip6.address.ip if d.primary_ip6 else "")
            )
            inner_devices.append(
                {
                    "id": str(d.id),
                    "name": d.name,
                    "role": getattr(d.role, "name", "Unknown"),
                    "primaryIp": ip_str,
                    "nautobotUrl": d.get_absolute_url(),
                }
            )

        if not node_id:
            node_id = f"group-{devices[0].location_id}-{'ap' if is_ap_group else 'other'}"

        return {
            "id": node_id,
            "name": group_name,
            "siteId": str(site.id),
            "role": ap_role_name if is_ap_group else "Other",
            "type": "group",
            "deviceCount": len(devices),
            "devices": inner_devices,
            "status": "active",
            "vendor": "Nautobot",
            "description": f"Collection of {len(devices)} unconnected {'AP' if is_ap_group else 'device'}s in {loc_obj.name}",
        }

    def _get_site_vlans(self, locations):
        """Aggregate all VLANs in the site hierarchy."""
        return sorted(
            list(
                set(
                    f"{vid} - {name}"
                    for vid, name in VLAN.objects.filter(location__in=locations).values_list("vid", "name")
                )
            )
        )

    def _get_site_prefixes(self, locations):
        """Aggregate all Prefixes in the site hierarchy."""
        return sorted(
            list(
                set(
                    f"{net}/{len}"
                    for net, len in Prefix.objects.filter(location__in=locations).values_list(
                        "network", "prefix_length"
                    )
                )
            )
        )

    @action(detail=True, methods=["get"])
    def metrics(self, request, pk=None):
        """Return per‑link traffic metrics for a site."""
        plugin_cfg = getattr(settings, "PLUGINS_CONFIG", {}).get("nautobot_topology", {})
        if not plugin_cfg.get("prometheus_enabled", False):
            return Response({"status": "success", "data": {"metrics": {}}})

        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)

        locations = get_locations_for_site(site)
        device_ids = Device.objects.filter(location_id__in=locations).values_list("id", flat=True)

        cables = Cable.objects.filter(
            _termination_a_device_id__in=device_ids,
            _termination_b_device_id__in=device_ids,
        ).select_related("_termination_a_device", "_termination_b_device")

        metrics = self._fetch_prometheus_metrics(cables, plugin_cfg)
        return Response({"status": "success", "data": {"metrics": metrics}})

    def _fetch_prometheus_metrics(self, cables, plugin_cfg):
        """Fetch metrics from Prometheus for the given cables."""
        prometheus_url = plugin_cfg.get("prometheus_url", "http://prometheus:9090")
        query_tx_tpl = plugin_cfg.get("prometheus_query_tx")
        query_rx_tpl = plugin_cfg.get("prometheus_query_rx")
        capacity_bps = 1_000_000_000

        metrics = {}
        for cable in cables:
            term_a, term_b = cable.termination_a, cable.termination_b
            if not (hasattr(term_a, "device") and hasattr(term_b, "device")):
                continue

            if prometheus_url == "mock":
                tx_rate = random.uniform(10_000, 800_000_000)
                rx_rate = random.uniform(10_000, 800_000_000)
            else:
                tx_rate = (
                    self._query_prometheus(
                        prometheus_url, query_tx_tpl.format(device=term_a.device.name, interface=term_a.name)
                    )
                    or 0.0
                )
                rx_rate = (
                    self._query_prometheus(
                        prometheus_url, query_rx_tpl.format(device=term_b.device.name, interface=term_b.name)
                    )
                    or 0.0
                )

            utilization = min(100.0, ((tx_rate + rx_rate) / capacity_bps) * 100.0)
            metrics[str(cable.id)] = {"tx": tx_rate, "rx": rx_rate, "utilization": utilization}

        return metrics

    def _query_prometheus(self, url, query):
        """Helper to perform a single Prometheus query."""
        try:
            resp = requests.get(f"{url}/api/v1/query", params={"query": query}, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            if data.get("status") == "success" and data.get("data", {}).get("result"):
                return float(data["data"]["result"][0]["value"][1])
        except Exception:
            pass
        return None

    @action(detail=True, methods=["get", "post"])
    def layout(self, request, pk=None):
        """Get or save the layout positions for nodes in a site."""

        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)

        if request.method == "POST":
            # Store the raw layout dictionary (e.g. { "node_id": { "x": 1, "y": 2 }, ... })
            layout_data = request.data
            TopologyLayout.objects.update_or_create(site=site, defaults={"layout_data": layout_data})
            return Response({"status": "success", "message": "Layout saved"})

        try:
            layout_obj = TopologyLayout.objects.get(site=site)
            layout_data = layout_obj.layout_data
        except TopologyLayout.DoesNotExist:
            layout_data = {"nodes": []}

        return Response({"status": "success", "data": layout_data})

    @action(detail=True, methods=["get"])
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

    @action(detail=True, methods=["get"])
    def devices(self, request, pk=None):
        """Return all devices in a site and its sub-locations recursively."""
        try:
            site = Location.objects.get(pk=pk)
        except Location.DoesNotExist:
            return Response({"status": "error", "message": "Site not found"}, status=404)

        locations = get_locations_for_site(site)
        devices = Device.objects.filter(location__in=locations).select_related(
            "role", "primary_ip4", "primary_ip6", "status", "location"
        )

        # Serialize simply for discovery
        data = []
        for d in devices:
            primary_ip = ""
            if d.primary_ip4:
                primary_ip = str(d.primary_ip4.address.ip)
            elif d.primary_ip6:
                primary_ip = str(d.primary_ip6.address.ip)

            data.append(
                {
                    "id": str(d.id),
                    "name": d.name,
                    "role": {"name": getattr(d.role, "name", "Unknown")},
                    "status": {"name": getattr(d.status, "name", "Unknown")},
                    "primary_ip4": ({"display": primary_ip, "address": primary_ip} if primary_ip else None),
                    "location": {
                        "name": d.location.name,
                        "display": d.location.display,
                    },
                }
            )

        return Response({"status": "success", "results": data})

    @action(detail=False, methods=["post"])
    def import_cables(self, request):
        """Import accepted cables into Nautobot."""
        cables_data = request.data.get("cables", [])
        created_cables = []
        errors = []

        try:
            active_status = Status.objects.get(name="Connected")
        except Status.DoesNotExist:
            active_status = Status.objects.filter(content_types__model="cable").first()

        for cable_spec in cables_data:
            term_a_id = cable_spec.get("local_interface_id")
            term_b_id = cable_spec.get("remote_interface_id")

            if not term_a_id or not term_b_id:
                errors.append(f"Missing interface ID for {cable_spec}")
                continue

            try:
                # Model mapping
                model_map = {
                    "interface": Interface,
                    "frontport": FrontPort,
                    "rearport": RearPort,
                    "consoleport": ConsolePort,
                    "consoleserverport": ConsoleServerPort,
                }

                local_type = cable_spec.get("local_interface_type", "interface")
                remote_type = cable_spec.get("remote_interface_type", "interface")

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
                    type=cable_spec.get("type", "cat6a"),
                    status=active_status,
                )
                cable.validated_save()
                created_cables.append(str(cable.id))
            except Exception as e:
                errors.append(f"Error creating cable between {term_a_id} and {term_b_id}: {str(e)}")

        return Response(
            {
                "status": "success" if not errors else "partial",
                "created": len(created_cables),
                "errors": errors,
            }
        )
