import os
import django
import time
from datetime import datetime

os.environ.setdefault("NAUTOBOT_CONFIG", "/opt/nautobot/nautobot_config.py")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "nautobot.core.settings")
django.setup()

from django.test import RequestFactory  # noqa: E402
from nautobot_topology.api.views import TopologyViewSet  # noqa: E402
from nautobot.dcim.models import Location  # noqa: E402


def benchmark():
    print(f"[{datetime.now()}] Starting benchmark for 10k nodes...")

    # Get the site
    site = Location.objects.get(name="Stress Site 10k")
    view = TopologyViewSet()
    view.action = "retrieve"

    # Create a mock request
    factory = RequestFactory()
    request = factory.get(f"/api/plugins/topology/{site.id}/")

    print("Executing retrieve action...")
    start_time = time.time()
    response = view.retrieve(request, pk=site.id)
    end_time = time.time()

    duration = end_time - start_time
    print(f"[{datetime.now()}] Benchmark complete.")
    print(f"Response Status: {response.status_code}")
    print(f"Duration: {duration:.4f} seconds")

    if response.status_code == 200:
        data = response.data.get("data", {})
        nodes = data.get("nodes", [])
        links = data.get("links", [])
        print(f"Nodes aggregated: {len(nodes)}")
        print(f"Links aggregated: {len(links)}")

        # Approximate memory size (very rough)
        print(f"Data size (JSON approach): {len(str(response.data)) / 1024 / 1024:.2f} MB")
    else:
        print(f"Error: {response.data}")


if __name__ == "__main__":
    benchmark()
