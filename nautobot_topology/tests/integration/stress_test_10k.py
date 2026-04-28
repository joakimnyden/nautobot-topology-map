import os
import django
import random
from datetime import datetime

os.environ.setdefault("NAUTOBOT_CONFIG", "/opt/nautobot/nautobot_config.py")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nautobot.core.settings")
django.setup()

from django.db import transaction  # noqa: E402
from nautobot.dcim.models import (  # noqa: E402
    Device, DeviceType, Location, LocationType, Manufacturer, Interface, Cable
)
from nautobot.extras.models import Role, Status  # noqa: E402


def generate_10k():
    print(f"[{datetime.now()}] Starting stress data generation (10k nodes, 20k cables)...")

    # Get metadata
    active_status = Status.objects.get(name="Active")
    mfr, _ = Manufacturer.objects.get_or_create(name="Cisco")
    dt, _ = DeviceType.objects.get_or_create(manufacturer=mfr, model="Generic Switch")
    ap_dt, _ = DeviceType.objects.get_or_create(manufacturer=mfr, model="Generic AP")
    sw_role, _ = Role.objects.get_or_create(name="Switch")
    ap_role, _ = Role.objects.get_or_create(name="Access Point")

    # Location Hierarchy
    site_lt, _ = LocationType.objects.get_or_create(name="Site")
    room_lt, _ = LocationType.objects.get_or_create(name="Room")
    if not room_lt.parent:
        room_lt.parent = site_lt
        room_lt.save()

    rack_lt, _ = LocationType.objects.get_or_create(name="Rack")
    if not rack_lt.parent:
        rack_lt.parent = room_lt
        rack_lt.save()

    site, _ = Location.objects.get_or_create(
        name="Stress Site 10k",
        location_type=site_lt,
        defaults={"status": active_status, "latitude": 37.7749, "longitude": -122.4194},
    )

    # Precise Cleanup: Delete devices starting with stress- or in this specific site
    print("Cleaning up old stress data...")
    Device.objects.filter(name__startswith="core-").delete()
    Device.objects.filter(name__startswith="dist-").delete()
    Device.objects.filter(name__startswith="access-").delete()
    Location.objects.filter(name__startswith="Room-", parent=site).delete()
    # Racks will be deleted by cascade since they are children of Rooms

    # Create 50 Rooms, 200 Racks
    rooms = []
    for i in range(50):
        room = Location(name=f"Room-{i}", location_type=room_lt, parent=site, status=active_status)
        rooms.append(room)
    rooms = Location.objects.bulk_create(rooms)

    racks = []
    for room in rooms:
        for j in range(4):  # 50 * 4 = 200 racks
            rack = Location(name=f"{room.name}-Rack-{j}", location_type=rack_lt, parent=room, status=active_status)
            racks.append(rack)
    racks = Location.objects.bulk_create(racks)

    print(f"Created {len(rooms)} rooms and {len(racks)} racks.")

    # Create 10,000 Devices
    # 10 Core, 40 Distribution, 9950 Access

    # 10 Core switches at the site level
    core_switches = []
    for i in range(10):
        d = Device(name=f"core-{i}", device_type=dt, role=sw_role, location=site, status=active_status)
        core_switches.append(d)
    core_switches = Device.objects.bulk_create(core_switches)

    # 40 Distribution switches in rooms
    dist_switches = []
    for i in range(40):
        room = random.choice(rooms)
        d = Device(name=f"dist-{i}", device_type=dt, role=sw_role, location=room, status=active_status)
        dist_switches.append(d)
    dist_switches = Device.objects.bulk_create(dist_switches)

    # 9,950 Access switches/APs in racks
    access_devices = []
    for i in range(9950):
        rack = random.choice(racks)
        is_ap = i % 5 == 0  # 20% APs
        d = Device(
            name=f"access-{i}",
            device_type=ap_dt if is_ap else dt,
            role=ap_role if is_ap else sw_role,
            location=rack,
            status=active_status,
        )
        access_devices.append(d)
    access_devices = Device.objects.bulk_create(access_devices)

    all_devices = core_switches + dist_switches + access_devices
    print(f"Created {len(all_devices)} devices.")

    # Create Interfaces for all devices
    print("Creating interfaces...")
    interfaces = []
    for d in all_devices:
        if d.role == sw_role and d.name.startswith("core"):
            iface_count = 500
        elif d.role == sw_role and d.name.startswith("dist"):
            iface_count = 500
        else:
            iface_count = 4

        for i in range(iface_count):
            interfaces.append(Interface(device=d, name=f"eth{i}", status=active_status))
    interfaces = Interface.objects.bulk_create(interfaces)

    # Fetch interfaces back for cabling
    iface_map = {}  # device_id -> [interfaces]
    for iface in Interface.objects.filter(device__in=all_devices):
        if iface.device_id not in iface_map:
            iface_map[iface.device_id] = []
        iface_map[iface.device_id].append(iface)

    # Create 20,000 Cables
    print("Creating 20,000 cables (hierarchical)...")
    cables = []
    used_interfaces = set()

    def get_available_iface(dev_id):
        for iface in iface_map.get(dev_id, []):
            if iface.id not in used_interfaces:
                return iface
        return None

    with transaction.atomic():
        # 1. Core to Distribution
        for ds in dist_switches:
            targets = random.sample(core_switches, 2)
            for cs in targets:
                iface_a = get_available_iface(ds.id)
                iface_b = get_available_iface(cs.id)
                if iface_a and iface_b:
                    cables.append(Cable(termination_a=iface_a, termination_b=iface_b, status=active_status))
                    used_interfaces.add(iface_a.id)
                    used_interfaces.add(iface_b.id)

        # 2. Distribution to Access
        for ad in access_devices:
            targets = random.sample(dist_switches, random.randint(1, 2))
            for ds in targets:
                iface_a = get_available_iface(ad.id)
                iface_b = get_available_iface(ds.id)
                if iface_a and iface_b:
                    cables.append(Cable(termination_a=iface_a, termination_b=iface_b, status=active_status))
                    used_interfaces.add(iface_a.id)
                    used_interfaces.add(iface_b.id)

        # Fill remaining (this might be slow if we need many more)
        # Actually 10k core/dist/access should already have many cables.
        # But let's add some more if needed.
        print(f"Hierarchical cables created: {len(cables)}")

    print(f"Finalizing cable creation ({len(cables)} total)...")
    # Manually populate cache fields for Nautobot 3.x+ efficiency
    for cable in cables:
        try:
            cable._termination_a_device_id = cable.termination_a.device_id
            cable._termination_b_device_id = cable.termination_b.device_id
        except AttributeError:
            pass  # Not a device termination

    Cable.objects.bulk_create(cables)

    print(f"[{datetime.now()}] Stress data generation complete.")


if __name__ == "__main__":
    generate_10k()
