# Nautobot Topology Plugin Structure

This project is organized as a Nautobot plugin with a React frontend.

## Directory Structure

```text
nautobot-topology/
├── README.md           # Plugin-specific documentation
├── pyproject.toml      # Python package configuration (Nautobot 3.0.8+)
├── nautobot_topology/  # Python source code
│   ├── __init__.py     # Plugin configuration
│   ├── api/            # REST API endpoints
│   ├── navigation.py   # Nautobot UI navigation
│   ├── static/         # Built frontend assets
│   ├── tests/          # Python test suite
│   ├── urls.py         # URL routing
│   └── views.py        # Django views
└── frontend/           # React frontend source
    ├── src/            # UI components and logic
    ├── package.json    # Frontend dependencies
    └── vite.config.ts  # Build configuration
```
