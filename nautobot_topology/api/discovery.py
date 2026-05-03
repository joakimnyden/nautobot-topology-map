from nautobot.extras.choices import (
    SecretsGroupAccessTypeChoices,
    SecretsGroupSecretTypeChoices,
)
from nautobot.dcim.models import Device
from netmiko import ConnectHandler
import re
from django.db.models import Q


def get_device_credentials(device):
    if not device.secrets_group:
        raise ValueError(f"No secrets group assigned to device {device.name}")

    def get_val(secret_type):
        # Try SSH and Console first, then fall back to Generic
        for access_type in [
            SecretsGroupAccessTypeChoices.TYPE_SSH,
            SecretsGroupAccessTypeChoices.TYPE_CONSOLE,
            SecretsGroupAccessTypeChoices.TYPE_GENERIC,
        ]:
            try:
                val = device.secrets_group.get_secret_value(
                    access_type=access_type, secret_type=secret_type, obj=device
                )
                if val:
                    return val
            except Exception:
                continue
        return None

    username = get_val(SecretsGroupSecretTypeChoices.TYPE_USERNAME)
    password = get_val(SecretsGroupSecretTypeChoices.TYPE_PASSWORD)
    secret = get_val(SecretsGroupSecretTypeChoices.TYPE_SECRET)

    if not username:
        raise ValueError(
            f"Could not find 'username' in secrets group '{device.secrets_group.name}' (checked SSH, Console, Generic)"
        )
    if not password:
        raise ValueError(
            f"Could not find 'password' in secrets group '{device.secrets_group.name}' (checked SSH, Console, Generic)"
        )

    return username, password, secret


def guess_netmiko_device_type(device):
    """Guess the netmiko device_type based on platform or manufacturer."""
    if not device.platform:
        return "cisco_ios"  # Fallback

    platform_name = device.platform.name.lower()
    platform_slug = device.platform.slug.lower() if getattr(device.platform, "slug", None) else ""
    network_driver = device.platform.network_driver.lower() if device.platform.network_driver else ""

    # Check network_driver (often napalm/netmiko driver name)
    if "cisco_ios" in network_driver or "ios" in network_driver:
        return "cisco_ios"
    if "nxos" in network_driver or "nx-os" in network_driver:
        return "cisco_nxos"
    if "arista" in network_driver or "eos" in network_driver:
        return "arista_eos"
    if "juniper" in network_driver or "junos" in network_driver:
        return "juniper_junos"

    # Check platform name/slug
    if "ios-xr" in platform_name or "iosxr" in platform_name or "xr" in platform_slug:
        return "cisco_xr"
    if "nx-os" in platform_name or "nxos" in platform_slug:
        return "cisco_nxos"
    if "ios" in platform_name or "ios" in platform_slug:
        return "cisco_ios"
    if "arista" in platform_name or "eos" in platform_slug:
        return "arista_eos"
    if "junos" in platform_name or "juniper" in platform_name:
        return "juniper_junos"

    return "cisco_ios"  # Default fallback


from django.conf import settings  # noqa: E402
from django.core.exceptions import ValidationError  # noqa: E402
import random  # noqa: E402
import os  # noqa: E402


def setup_textfsm():
    """Ensure NET_TEXTFSM environment variable is set for netmiko."""
    if "NET_TEXTFSM" not in os.environ:
        try:
            import ntc_templates

            # Get the path to the templates directory
            templates_path = os.path.join(os.path.dirname(ntc_templates.__file__), "templates")
            if os.path.exists(templates_path):
                os.environ["NET_TEXTFSM"] = templates_path
        except ImportError:
            pass


def strip_domain_safe(name):
    """Strip domain from hostname but keep MAC addresses intact."""
    if not name:
        return ""

    # Handle various MAC formats to avoid splitting them by dots
    # Cisco style: aaaa.bbbb.cccc
    if re.match(r"^[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}\.[0-9a-fA-F]{4}$", name):
        return name
    # IEEE style: aa:bb:cc:dd:ee:ff or aa-bb-cc-dd-ee-ff
    if re.match(r"^([0-9a-fA-F]{2}[:\-]){5}[0-9a-fA-F]{2}$", name):
        return name
    # HP/others: aabbcc-ddeeff
    if re.match(r"^[0-9a-fA-F]{6}-[0-9a-fA-F]{6}$", name):
        return name
    # Another common format: aaaa.bbbb.cccc.dddd (e.g. for some APs)
    if re.match(r"^([0-9a-fA-F]{4}\.){2,3}[0-9a-fA-F]{4}$", name):
        return name
    # 001122.334455 format
    if re.match(r"^[0-9a-fA-F]{6}\.[0-9a-fA-F]{6}$", name):
        return name

    # If it contains dots but doesn't look like a MAC, it's likely a FQDN
    if "." in name:
        # Check if it's mostly hex - if so, it's likely a MAC we missed
        clean_name = name.replace(".", "").replace(":", "").replace("-", "")
        if len(clean_name) == 12 and all(c in "0123456789abcdefABCDEF" for c in clean_name):
            return name

        parts = name.split(".")
        return parts[0]

    return name


def discover_neighbors(device_id):
    setup_textfsm()
    device = Device.objects.get(id=device_id)

    # Check for simulator setting
    plugin_config = settings.PLUGINS_CONFIG.get("nautobot_topology", {})
    if plugin_config.get("discovery_simulator_enabled", False):
        # Return simulated neighbors for the device
        return simulate_neighbors(device)

    ip_address = None
    if device.primary_ip4:
        ip_address = str(device.primary_ip4.address.ip)
    elif device.primary_ip6:
        ip_address = str(device.primary_ip6.address.ip)

    if not ip_address:
        raise ValueError(f"Device {device.name} has no primary IP address configured")

    username, password, secret = get_device_credentials(device)
    device_type = guess_netmiko_device_type(device)

    # Connection parameters
    connection_params = {
        "device_type": device_type,
        "host": ip_address,
        "port": 22,
        "username": username,
        "password": password,
        "secret": secret or password,
        "global_delay_factor": 2,
    }

    neighbors = []

    with ConnectHandler(**connection_params) as net_connect:
        try:
            # Try LLDP first
            lldp_output = net_connect.send_command("show lldp neighbors detail", use_textfsm=True)
            if isinstance(lldp_output, list) and lldp_output:
                for entry in lldp_output:
                    # Depending on textfsm template, keys might vary. Standardize them.
                    # NTC templates usually return LOCAL_INTERFACE, NEIGHBOR, NEIGHBOR_INTERFACE
                    local_iface = entry.get("LOCAL_INTERFACE", entry.get("local_interface", ""))
                    remote_dev = entry.get(
                        "DESTINATION_HOST",
                        entry.get("neighbor", entry.get("NEIGHBOR", "")),
                    )
                    remote_iface = entry.get(
                        "REMOTE_PORT",
                        entry.get("neighbor_interface", entry.get("NEIGHBOR_INTERFACE", "")),
                    )
                    remote_ip = entry.get(
                        "MANAGEMENT_IP",
                        entry.get(
                            "management_ip",
                            entry.get("ADDRESS", entry.get("address", "")),
                        ),
                    )

                    if local_iface and remote_dev and remote_iface:
                        neighbors.append(
                            {
                                "local_interface": local_iface,
                                "remote_device": strip_domain_safe(remote_dev),
                                "remote_interface": remote_iface,
                                "remote_ip": remote_ip,
                                "protocol": "LLDP",
                            }
                        )
        except Exception:
            pass  # Try CDP if LLDP fails or isn't structured

        if not neighbors:
            try:
                # Try CDP if LLDP was empty
                cdp_output = net_connect.send_command("show cdp neighbors detail", use_textfsm=True)
                if isinstance(cdp_output, list) and cdp_output:
                    for entry in cdp_output:
                        local_iface = entry.get("LOCAL_PORT", entry.get("local_port", ""))
                        remote_dev = entry.get("DESTINATION_HOST", entry.get("destination_host", ""))
                        remote_iface = entry.get("REMOTE_PORT", entry.get("remote_port", ""))
                        remote_ip = entry.get(
                            "MANAGEMENT_IP",
                            entry.get(
                                "management_ip",
                                entry.get("ADDRESS", entry.get("address", "")),
                            ),
                        )

                        if local_iface and remote_dev and remote_iface:
                            neighbors.append(
                                {
                                    "local_interface": local_iface,
                                    "remote_device": strip_domain_safe(remote_dev),
                                    "remote_interface": remote_iface,
                                    "remote_ip": remote_ip,
                                    "protocol": "CDP",
                                }
                            )
            except Exception:
                pass

    return standardize_and_match_neighbors(device, neighbors)


def simulate_neighbors(device):
    """Simulate neighbors for a device by looking at other devices in the same location."""
    # Find some other devices in the same location to link to
    if not hasattr(device, "location") or not device.location:
        return []

    try:
        potential_neighbors = Device.objects.filter(location=device.location).exclude(id=device.id)[:3]
    except (ValidationError, TypeError, AttributeError):
        # Handle cases where location might be a mock or invalid in tests
        potential_neighbors = []

    raw_neighbors = []
    interfaces = list(device.interfaces.all()[:3])

    protocols = ["LLDP", "CDP"]

    for i, remote_dev in enumerate(potential_neighbors):
        if i < len(interfaces):
            remote_iface = remote_dev.interfaces.first()
            if remote_iface:
                raw_neighbors.append(
                    {
                        "local_interface": interfaces[i].name,
                        "remote_device": remote_dev.name,
                        "remote_interface": remote_iface.name,
                        "protocol": random.choice(protocols),
                    }
                )

    # Add one unknown neighbor
    if interfaces:
        raw_neighbors.append(
            {
                "local_interface": random.choice(interfaces).name,
                "remote_device": "unconfigured-switch-01",
                "remote_interface": "GigabitEthernet0/1",
                "protocol": "LLDP",
            }
        )

    return standardize_and_match_neighbors(device, raw_neighbors)


def normalize_interface_name(name):
    """Normalize interface names for better matching (e.g., Gi1/0/1 -> GigabitEthernet1/0/1)."""
    if not name:
        return ""
    name = name.lower()

    # Expand common abbreviations
    name = re.sub(r"^gi(\d)", r"gigabitethernet\1", name)
    name = re.sub(r"^te(\d)", r"tengigabitethernet\1", name)
    name = re.sub(r"^tw(\d)", r"twentyfivegigabitethernet\1", name)
    name = re.sub(r"^fo(\d)", r"fortygigabitethernet\1", name)
    name = re.sub(r"^hu(\d)", r"hundredgigabitethernet\1", name)
    name = re.sub(r"^fa(\d)", r"fastethernet\1", name)
    name = re.sub(r"^eth(\d)", r"ethernet\1", name)
    name = re.sub(r"^po(\d)", r"port-channel\1", name)
    name = re.sub(r"^ae(\d)", r"aggregate-ethernet\1", name)
    name = re.sub(r"^be(\d)", r"bundle-ether\1", name)

    return name


def _build_component_map(device):
    """Build a map of component names to their objects and types for a device."""
    cmap = {}

    def add_to_map(queryset, ctype):
        for obj in queryset:
            # Map original name and normalized name
            cmap[obj.name.lower()] = (obj, ctype)
            norm = normalize_interface_name(obj.name)
            if norm != obj.name.lower():
                cmap[norm] = (obj, ctype)

    add_to_map(device.interfaces.all(), "interface")
    if hasattr(device, "frontports"):
        add_to_map(device.frontports.all(), "frontport")
    if hasattr(device, "rearports"):
        add_to_map(device.rearports.all(), "rearport")
    if hasattr(device, "consoleports"):
        add_to_map(device.consoleports.all(), "consoleport")
    if hasattr(device, "consoleserverports"):
        add_to_map(device.consoleserverports.all(), "consoleserverport")

    return cmap


def standardize_and_match_neighbors(local_device, raw_neighbors):
    """Match raw parsed neighbors to actual Nautobot objects."""
    results = []

    # Pre-build local component map
    local_cmap = _build_component_map(local_device)

    # Cache for remote device lookups and their component maps
    remote_device_cache = {}
    remote_cmap_cache = {}

    for neighbor in raw_neighbors:
        local_iface_name = neighbor["local_interface"]
        remote_dev_name = neighbor["remote_device"]
        remote_iface_name = neighbor["remote_interface"]
        remote_ip = neighbor.get("remote_ip")

        # 1. Find local component
        norm_local_name = normalize_interface_name(local_iface_name)
        local_term_obj, local_term_type = local_cmap.get(norm_local_name, (None, None))
        if not local_term_obj:
            local_term_obj, local_term_type = local_cmap.get(local_iface_name.lower(), (None, None))

        # 2. Find remote device
        remote_dev_obj = None
        if remote_dev_name in remote_device_cache:
            remote_dev_obj = remote_device_cache[remote_dev_name]
        else:
            # Strategies for matching remote device
            possible_devices = Device.objects.filter(name__iexact=remote_dev_name)

            if not possible_devices.exists() and "." in remote_dev_name:
                short_name = remote_dev_name.split(".")[0]
                possible_devices = Device.objects.filter(name__iexact=short_name)

            if not possible_devices.exists():
                possible_devices = Device.objects.filter(name__istartswith=f"{remote_dev_name}.")

            if not possible_devices.exists() and remote_ip:
                clean_ip = remote_ip.split("/")[0] if "/" in remote_ip else remote_ip
                possible_devices = Device.objects.filter(Q(primary_ip4__host=clean_ip) | Q(primary_ip6__host=clean_ip))

            if not possible_devices.exists():
                clean_mac = remote_dev_name.replace(".", "").replace(":", "").replace("-", "").upper()
                if len(clean_mac) == 12 and all(c in "0123456789ABCDEF" for c in clean_mac):
                    possible_devices = Device.objects.filter(interfaces__mac_address=remote_dev_name)
                    if not possible_devices.exists():
                        formatted_mac = ":".join(clean_mac[i : i + 2] for i in range(0, 12, 2))
                        possible_devices = Device.objects.filter(interfaces__mac_address=formatted_mac)

            if possible_devices.exists():
                remote_dev_obj = possible_devices.first()
                remote_device_cache[remote_dev_name] = remote_dev_obj

        # 3. Find remote component
        remote_term_obj = None
        remote_term_type = None
        if remote_dev_obj:
            dev_id = str(remote_dev_obj.id)
            if dev_id not in remote_cmap_cache:
                remote_cmap_cache[dev_id] = _build_component_map(remote_dev_obj)

            rcmap = remote_cmap_cache[dev_id]
            norm_remote_name = normalize_interface_name(remote_iface_name)
            remote_term_obj, remote_term_type = rcmap.get(norm_remote_name, (None, None))
            if not remote_term_obj:
                remote_term_obj, remote_term_type = rcmap.get(remote_iface_name.lower(), (None, None))

        # Check if cable already exists
        cable_exists = bool(local_term_obj and getattr(local_term_obj, "cable", None))

        # Check LAG membership
        local_lag_name = local_term_obj.lag.name if local_term_type == "interface" and local_term_obj.lag else None
        remote_lag_name = remote_term_obj.lag.name if remote_term_type == "interface" and remote_term_obj.lag else None

        results.append(
            {
                "local_interface": local_iface_name,
                "local_interface_id": str(local_term_obj.id) if local_term_obj else None,
                "local_interface_type": local_term_type,
                "local_lag": local_lag_name,
                "remote_device": remote_dev_name,
                "remote_device_id": str(remote_dev_obj.id) if remote_dev_obj else None,
                "remote_interface": remote_iface_name,
                "remote_interface_id": str(remote_term_obj.id) if remote_term_obj else None,
                "remote_interface_type": remote_term_type,
                "remote_lag": remote_lag_name,
                "remote_ip": remote_ip,
                "protocol": neighbor["protocol"],
                "cable_exists": cable_exists,
                "is_matched": bool(local_term_obj and remote_dev_obj and remote_term_obj),
            }
        )

    return results

