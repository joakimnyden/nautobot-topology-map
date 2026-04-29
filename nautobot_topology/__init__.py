from nautobot.apps import NautobotAppConfig

__version__ = "1.1.0"


class TopologyConfig(NautobotAppConfig):
    name = "nautobot_topology"
    verbose_name = "Nautobot Topology"
    description = "Global and site-level network topology visualization."
    version = "1.1.0"
    base_url = "nautobot_topology"
    urls = "nautobot_topology.urls"
    api_urls = "nautobot_topology.api.urls"

    default_settings = {
        "prometheus_enabled": False,
        "prometheus_url": "http://prometheus:9090",
        "prometheus_query_tx": 'rate(ifOutOctets{{instance="{device}", ifName="{interface}"}}[5m]) * 8',
        "prometheus_query_rx": 'rate(ifInOctets{{instance="{device}", ifName="{interface}"}}[5m]) * 8',
        "topology_style": "fancy",
        "discovery_simulator_enabled": True,
    }


config = TopologyConfig
