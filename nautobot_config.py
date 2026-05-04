"""Nautobot development configuration file."""

# pylint: disable=invalid-envvar-default
import os
import sys

from nautobot.core.settings import *  # noqa: F403  # pylint: disable=wildcard-import,unused-wildcard-import
from nautobot.core.settings_funcs import is_truthy, parse_redis_connection

#
# Debug
#

DEBUG = is_truthy(os.getenv("NAUTOBOT_DEBUG", False))

TESTING = len(sys.argv) > 1 and sys.argv[1] == "test"

#
# Logging
#

LOG_LEVEL = "DEBUG" if DEBUG else "INFO"

#
# Redis
#

# Redis Cacheops
CACHEOPS_REDIS = parse_redis_connection(redis_database=1)

#
# Celery settings are not defined here because they can be overloaded with
# environment variables. By default they use `CACHES["default"]["LOCATION"]`.
#

# Enable installed plugins. Add the name of each plugin to the list.
# PLUGINS = ["nautobot_example_plugin"]

# Plugin configuration
PLUGINS = ["nautobot_topology", "nautobot_bgp_models"]

# Plugins configuration settings. These settings are used by various plugins that the user may have installed.
# Each key in the dictionary is the name of an installed plugin and its value is a dictionary of settings.
PLUGINS_CONFIG = {
    "nautobot_topology": {
        "prometheus_enabled": False,
        "topology_style": "fancy",
        "cache_timeout": 300,
        "discovery_simulator_enabled": True,
    },
}


# Security settings
SECRET_KEY = os.environ.get("NAUTOBOT_SECRET_KEY", "nautobot-secret-key-change-me")
ALLOWED_HOSTS = os.environ.get("NAUTOBOT_ALLOWED_HOSTS", "*").split(",")
DEBUG = os.environ.get("NAUTOBOT_DEBUG", "True") == "True"

# Static files
STATIC_ROOT = os.environ.get("NAUTOBOT_STATIC_ROOT", "/opt/nautobot/static")
if TESTING:
    STATIC_ROOT = "/tmp/static"
MEDIA_ROOT = "/opt/nautobot/media"

# Genrate mocked data for tests
TEST_USE_FACTORIES = True

# Allow overriding test database name
if TESTING:
    test_db_name = os.getenv("NAUTOBOT_TEST_DB_NAME")
    if test_db_name:
        DATABASES["default"]["TEST"] = {"NAME": test_db_name}
