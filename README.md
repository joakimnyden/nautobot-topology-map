# Nautobot Topology Plugin

An advanced network topology visualization plugin for Nautobot v3.0.8+. This plugin provides both macro (Global) and micro (Site-level) views of your infrastructure with real-time health indicators.

## Features

- **Global Infrastructure Map**: Interactive world map showing site distribution and operational status.
- **Site Topology Graph**: D3-powered force-directed graph visualizing device connections.
- **Protocol Awareness**: Visual distinction between physical links and logical protocols (BGP, HSRP, VXLAN, MLAG).
- **Interactive Navigation**: Seamless zoom, pan, and drill-down from global to site views.

## Installation

### Using pip
1. Install the package:
   ```bash
   pip install nautobot-topology
   ```

2. Enable the plugin in `nautobot_config.py`:
   ```python
   PLUGINS = [
       'nautobot_topology',
   ]
   ```

3. Run migrations and collect static files:
   ```bash
   nautobot-server migrate
   nautobot-server collectstatic
   ```

## Development

### Local Setup with uv
`uv` is a fast Python package manager recommended for development.
```bash
uv venv
source .venv/bin/activate
uv pip install -e ".[dev]"
```

### Frontend Development
The UI is built with React. To modify the frontend:
1. Navigate to the `frontend/` directory.
2. Run `npm install` and `npm run build`.
3. The `vite.config.ts` is configured to output the compiled assets directly to `nautobot_topology/static/nautobot_topology/`.

### Docker Development
```bash
invoke build
invoke start
```

## Building and Releasing

### Manual Build
To build the package locally using `uv`:
1. Build the frontend:
   ```bash
   cd frontend && npm install && npm run build && cd ..
   ```
2. Build the Python package:
   ```bash
   uv build
   ```
The built files will be in the `dist/` directory.

### Automated Release (GitHub Actions)
This project includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automates the build and release process.

1. **Triggering a Release**:
   - Push a new tag starting with `v` (e.g., `v1.0.0`):
     ```bash
     git tag v1.0.0
     git push origin v1.0.0
     ```
2. **What the Pipeline Does**:
   - Builds the React frontend.
   - Builds the Python wheel and source distribution.
   - Creates a GitHub Release with the built assets.
   - (Optional) Publishes to PyPI if configured.

3. **PyPI Configuration**:
   - To enable PyPI publishing, add a `PYPI_API_TOKEN` secret to your GitHub repository and uncomment the "Publish to PyPI" step in `.github/workflows/release.yml`.

For more detailed development instructions, see the [Plugin README](./README.md).
