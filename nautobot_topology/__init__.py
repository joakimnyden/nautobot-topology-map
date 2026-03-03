from nautobot.apps import NautobotAppConfig

__version__ = "1.0.0"

class TopologyConfig(NautobotAppConfig):
    name = 'nautobot_topology'
    verbose_name = 'Nautobot Topology Nexus'
    description = 'Global and site-level network topology visualization.'
    version = '1.0.0'
    base_url = 'topology-nexus'

config = TopologyConfig
