from nautobot.extras.choices import SecretsGroupAccessTypeChoices, SecretsGroupSecretTypeChoices
from nautobot.dcim.models import Device, Interface, Cable
from netmiko import ConnectHandler
import re

def get_device_credentials(device):
    if not device.secrets_group:
        raise ValueError(f"No secrets group assigned to device {device.name}")
        
    def get_val(secret_type):
        # Try SSH and Console first, then fall back to Generic
        for access_type in [
            SecretsGroupAccessTypeChoices.TYPE_SSH, 
            SecretsGroupAccessTypeChoices.TYPE_CONSOLE, 
            SecretsGroupAccessTypeChoices.TYPE_GENERIC
        ]:
            try:
                val = device.secrets_group.get_secret_value(
                    access_type=access_type,
                    secret_type=secret_type,
                    obj=device
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
        raise ValueError(f"Could not find 'username' in secrets group '{device.secrets_group.name}' (checked SSH, Console, Generic)")
    if not password:
        raise ValueError(f"Could not find 'password' in secrets group '{device.secrets_group.name}' (checked SSH, Console, Generic)")
        
    return username, password, secret

def guess_netmiko_device_type(device):
    """Guess the netmiko device_type based on platform or manufacturer."""
    if not device.platform:
        return "cisco_ios" # Fallback
        
    platform_name = device.platform.name.lower()
    platform_slug = device.platform.slug.lower() if getattr(device.platform, 'slug', None) else ""
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
        
    return "cisco_ios" # Default fallback

from django.conf import settings
import random

def discover_neighbors(device_id):
    device = Device.objects.get(id=device_id)
    
    # Check for simulator setting
    plugin_config = settings.PLUGINS_CONFIG.get('nautobot_topology', {})
    if plugin_config.get('discovery_simulator_enabled', False):
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
                    remote_dev = entry.get("DESTINATION_HOST", entry.get("neighbor", entry.get("NEIGHBOR", "")))
                    remote_iface = entry.get("REMOTE_PORT", entry.get("neighbor_interface", entry.get("NEIGHBOR_INTERFACE", "")))
                    remote_ip = entry.get("MANAGEMENT_IP", entry.get("management_ip", entry.get("ADDRESS", entry.get("address", ""))))
                    
                    if local_iface and remote_dev and remote_iface:
                        neighbors.append({
                            "local_interface": local_iface,
                            "remote_device": remote_dev.split(".")[0], # Strip domain names
                            "remote_interface": remote_iface,
                            "remote_ip": remote_ip,
                            "protocol": "LLDP"
                        })
        except Exception as e:
            pass # Try CDP if LLDP fails or isn't structured
            
        if not neighbors:
            try:
                # Try CDP if LLDP was empty
                cdp_output = net_connect.send_command("show cdp neighbors detail", use_textfsm=True)
                if isinstance(cdp_output, list) and cdp_output:
                    for entry in cdp_output:
                        local_iface = entry.get("LOCAL_PORT", entry.get("local_port", ""))
                        remote_dev = entry.get("DESTINATION_HOST", entry.get("destination_host", ""))
                        remote_iface = entry.get("REMOTE_PORT", entry.get("remote_port", ""))
                        remote_ip = entry.get("MANAGEMENT_IP", entry.get("management_ip", entry.get("ADDRESS", entry.get("address", ""))))
                        
                        if local_iface and remote_dev and remote_iface:
                            neighbors.append({
                                "local_interface": local_iface,
                                "remote_device": remote_dev.split(".")[0],
                                "remote_interface": remote_iface,
                                "remote_ip": remote_ip,
                                "protocol": "CDP"
                            })
            except Exception as e:
                pass
                
    return standardize_and_match_neighbors(device, neighbors)

def simulate_neighbors(device):
    """Simulate neighbors for a device by looking at other devices in the same location."""
    # Find some other devices in the same location to link to
    potential_neighbors = Device.objects.filter(location=device.location).exclude(id=device.id)[:3]
    
    raw_neighbors = []
    interfaces = list(device.interfaces.all()[:3])
    
    protocols = ["LLDP", "CDP"]
    
    for i, remote_dev in enumerate(potential_neighbors):
        if i < len(interfaces):
            remote_iface = remote_dev.interfaces.first()
            if remote_iface:
                raw_neighbors.append({
                    "local_interface": interfaces[i].name,
                    "remote_device": remote_dev.name,
                    "remote_interface": remote_iface.name,
                    "protocol": random.choice(protocols)
                })
    
    # Add one unknown neighbor
    if interfaces:
        raw_neighbors.append({
            "local_interface": random.choice(interfaces).name,
            "remote_device": "unconfigured-switch-01",
            "remote_interface": "GigabitEthernet0/1",
            "protocol": "LLDP"
        })
        
    return standardize_and_match_neighbors(device, raw_neighbors)

def normalize_interface_name(name):
    """Normalize interface names for better matching (e.g., Gi1/0/1 -> GigabitEthernet1/0/1)."""
    if not name:
        return ""
    name = name.lower()
    
    # Expand common abbreviations
    name = re.sub(r'^gi(\d)', r'gigabitethernet\1', name)
    name = re.sub(r'^te(\d)', r'tengigabitethernet\1', name)
    name = re.sub(r'^tw(\d)', r'twentyfivegigabitethernet\1', name)
    name = re.sub(r'^fo(\d)', r'fortygigabitethernet\1', name)
    name = re.sub(r'^hu(\d)', r'hundredgigabitethernet\1', name)
    name = re.sub(r'^fa(\d)', r'fastethernet\1', name)
    name = re.sub(r'^eth(\d)', r'ethernet\1', name)
    name = re.sub(r'^po(\d)', r'port-channel\1', name)
    name = re.sub(r'^ae(\d)', r'aggregate-ethernet\1', name)
    name = re.sub(r'^be(\d)', r'bundle-ether\1', name)
    
    return name

def standardize_and_match_neighbors(local_device, raw_neighbors):
    """Match raw parsed neighbors to actual Nautobot objects."""
    results = []
    
    for neighbor in raw_neighbors:
        local_iface_name = neighbor["local_interface"]
        remote_dev_name = neighbor["remote_device"]
        remote_iface_name = neighbor["remote_interface"]
        remote_ip = neighbor.get("remote_ip")
        
        # 1. Try to find the local component (Interface, FrontPort, RearPort, ConsolePort, ConsoleServerPort)
        local_term_obj = None
        local_term_type = None
        
        # Helper to find component by name
        def find_component(device, name):
            norm_name = normalize_interface_name(name)
            
            # Check Interfaces
            for iface in device.interfaces.all():
                if normalize_interface_name(iface.name) == norm_name or iface.name.lower() == name.lower():
                    return iface, "interface"
            
            # Check FrontPorts
            if hasattr(device, 'frontports'):
                for fp in device.frontports.all():
                    if normalize_interface_name(fp.name) == norm_name or fp.name.lower() == name.lower():
                        return fp, "frontport"
            
            # Check RearPorts
            if hasattr(device, 'rearports'):
                for rp in device.rearports.all():
                    if normalize_interface_name(rp.name) == norm_name or rp.name.lower() == name.lower():
                        return rp, "rearport"
            
            # Check ConsolePorts
            if hasattr(device, 'consoleports'):
                for cp in device.consoleports.all():
                    if normalize_interface_name(cp.name) == norm_name or cp.name.lower() == name.lower():
                        return cp, "consoleport"

            # Check ConsoleServerPorts
            if hasattr(device, 'consoleserverports'):
                for csp in device.consoleserverports.all():
                    if normalize_interface_name(csp.name) == norm_name or csp.name.lower() == name.lower():
                        return csp, "consoleserverport"
                        
            return None, None

        local_term_obj, local_term_type = find_component(local_device, local_iface_name)
                
        # 2. Try to find the remote device
        remote_dev_obj = None
        
        # Strategy A: Exact match
        possible_devices = Device.objects.filter(name=remote_dev_name)
        
        # Strategy B: Case-insensitive exact match
        if not possible_devices.exists():
            possible_devices = Device.objects.filter(name__iexact=remote_dev_name)
            
        # Strategy C: Short name match (if remote_dev_name has a domain)
        if not possible_devices.exists() and "." in remote_dev_name:
            short_name = remote_dev_name.split(".")[0]
            possible_devices = Device.objects.filter(name__iexact=short_name)
            
        # Strategy D: Check if any Nautobot device name contains this name as its hostname
        if not possible_devices.exists():
            # This handles case where remote_dev_name is "switch-01" but Nautobot has "switch-01.domain.com"
            possible_devices = Device.objects.filter(name__istartswith=f"{remote_dev_name}.")
            
        # Strategy E: Match by IP address (if provided)
        if not possible_devices.exists() and remote_ip:
            # Check primary IPv4 and IPv6
            possible_devices = Device.objects.filter(
                primary_ip4__address__host=remote_ip
            ) | Device.objects.filter(
                primary_ip6__address__host=remote_ip
            )
            
        if possible_devices.exists():
            remote_dev_obj = possible_devices.first()
            
        # 3. Try to find the remote component
        remote_term_obj = None
        remote_term_type = None
        if remote_dev_obj:
            remote_term_obj, remote_term_type = find_component(remote_dev_obj, remote_iface_name)
                    
        # Check if cable already exists
        cable_exists = False
        if local_term_obj and hasattr(local_term_obj, 'cable') and local_term_obj.cable:
            cable_exists = True
            
        # Check LAG membership
        local_lag_name = None
        if local_term_type == 'interface' and local_term_obj.lag:
            local_lag_name = local_term_obj.lag.name
            
        remote_lag_name = None
        if remote_term_type == 'interface' and remote_term_obj.lag:
            remote_lag_name = remote_term_obj.lag.name

        results.append({
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
            "is_matched": bool(local_term_obj and remote_dev_obj and remote_term_obj)
        })
        
    return results
