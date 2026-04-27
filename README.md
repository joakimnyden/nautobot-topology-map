# Nautobot Topology Plugin

An advanced network topology visualization plugin for Nautobot v3.0+. This plugin provides both macro (Global) and micro (Site-level) views of your infrastructure with real-time health indicators.

## Features

- **Global Infrastructure Map**: Interactive world map showing site distribution and operational status.
- **Site Topology Graph**: High-performance React Flow graph visualizing physical and logical connectivity.
- **Layout Persistence**: User-defined node positions are saved to the Nautobot backend and restored on refresh.
- **High-Fidelity Export**: Built-in PNG snapshot generator with UI-filtering for professional documentation.
- **Modern Aesthetic**: Premium "glassmorphism" UI with ultra-rounded corners and integrated typographic controls.
- **Double-Click Navigation**: Deep integration with Nautobot for direct object inspection.
- **Protocol Awareness**: Deep discovery of BGP peerings, LAG memberships, and logical adjacencies.

## Installation

### Installation from Source

To install the plugin from source in a Nautobot environment:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-org/nautobot-topology.git
   cd nautobot-topology
   ```

2. **Build the frontend assets**:
   ```bash
   cd frontend
   npm install
   npm run build
   cd ..
   ```
   *Note: This generates the static assets that will be packaged with the plugin.*

3. **Activate the Nautobot virtual environment**:
   ```bash
   source /opt/nautobot/bin/activate
   ```

4. **Install the package**:
   ```bash
   pip install .
   ```
   *Note: Use `-e` for an editable installation if you plan to make changes.*

4. **Enable the plugin** in your `nautobot_config.py`:
   ```python
   PLUGINS = [
       "nautobot_topology",
   ]
   ```

5. **Finalize the installation** (Applies database migrations and collects static assets):
   ```bash
   nautobot-server post_upgrade
   ```

6. **Restart Nautobot services**:
   ```bash
   sudo systemctl restart nautobot nautobot-worker
   ```

## Configuration

You can customize the plugin behavior in your `nautobot_config.py`:

```python
PLUGINS_CONFIG = {
    "nautobot_topology": {
        "ap_role_name": "Access Point",  # The specific role name used to identify APs for grouping/stacking
        "allowed_statuses": ["Active"],
        "cache_timeout": 300,
        "prometheus_enabled": False,
    }
}
```

## Development

### Local Setup with `uv`

`uv` is the recommended Python package manager for this project.

1. **Clone and initialize**:
   ```bash
   git clone <repo-url>
   cd nautobot-topology
   uv venv
   source .venv/bin/activate
   uv pip install -e ".[dev]"
   ```

### Frontend Development (Mock Server)

For rapid UI development, you can run the frontend in isolation with a mock backend:

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
2. Access the development UI at `http://localhost:3000`. This uses `frontend/server.ts` to simulate Nautobot API responses.

### Full Environment with Docker

To test the plugin within a live Nautobot instance:

1. **Build and start**:
   ```bash
   invoke build
   invoke start
   ```
2. **Apply database migrations**:
   ```bash
   invoke migrate
   ```
3. The environment will be available at `http://localhost:8080`.

## Project Structure

```text
nautobot-topology/
├── pyproject.toml      # Python package configuration
├── tasks.py            # Invoke automation tasks
├── docs/               # Advanced workflow and internal documentation
├── nautobot_topology/  # Python source code
│   ├── api/            # REST API endpoints
│   ├── navigation.py   # Nautobot UI navigation
│   ├── static/         # Built frontend assets
│   ├── templates/      # Django templates
│   ├── urls.py         # URL routing
│   └── views.py        # Django views
└── frontend/           # React frontend source
    ├── src/            
    │   ├── hooks/      # Custom React hooks for logic separation
    │   ├── components/ # Granular UI components
    │   └── utils/      # Shared utilities
    ├── vitest.config.ts # Testing configuration
    └── vite.config.ts  # Build configuration
```

## Performance & Scalability

The topology map is engineered for high-density environments:
- **LOD System**: Four levels of detail (Micro, Low, Mid, High) trigger based on zoom thresholds.
- **Grid Fallback**: Automatic transition from Dagre-force layout to Grid layout for datasets > 500 nodes.
- **Memoized Lookups**: O(1) device and link resolution using Map-based reconciliation.

## Building and Releasing

### Manual Build
1. **Build the frontend**:
   ```bash
   npm run build --prefix frontend
   ```
2. **Build the Python package**:
   ```bash
   uv build
   ```

### Automated Release
Push a new tag starting with `v` (e.g., `v1.0.0`) to trigger the GitHub Actions release pipeline.
