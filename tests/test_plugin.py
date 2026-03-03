import unittest
from django.test import TestCase
from nautobot_topology import __version__

class PluginTest(TestCase):
    def test_version(self):
        self.assertEqual(__version__, "1.0.0")

    def test_plugin_config(self):
        from nautobot_topology import config
        self.assertEqual(config.name, "nautobot_topology")
        self.assertEqual(config.verbose_name, "Nautobot Topology Nexus")
