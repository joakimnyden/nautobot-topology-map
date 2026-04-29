# Antigravity Agent Workflow & Context Guide
**Nautobot Topology Map Development**

## 1. Core Workflow (MANDATORY FOR EVERY TASK)
Follow these steps strictly for *every* task to ensure consistency and stability:

1. **Environment Setup & Calibration**: 
   - Check binaries: `export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"`
   - If `uv` is missing: `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - Use `docker compose exec` to maintain session state.

2. **Execute via Invoke**: 
   - NEVER type raw bash commands for standard development tasks. 
   - Use `uv run invoke [task_name]` (e.g., `start`, `stop`, `test`, `build-ui`).
   - The `test` task is simplified to run as a single standard Nautobot test suite.

3. **Mandatory Validation & QA**:
   - **Frontend Changes**: Always run `uv run invoke build-ui`.
   - **Backend Changes**: Always run `uv run invoke test` (Requires minimum 80% coverage).
   - Never assume changes work without testing.

4. **Context Management**: 
   - Monitor conversation length. If context drifts or slows down, explicitly suggest a new conversation and provide a **State Transition Summary** (Current State, Open Issues, Environment State, Key Files).

5. **Workflow Maintenance**: 
   - Update this file (`docs/agent_workflow.md`) if new architectural decisions, patterns, or directives are established.

## 2. Project Directory Mapping
- **`nautobot_topology/api/`**: Backend REST logic, data fetching, aggregations.
- **`nautobot_topology/`**: Core plugin settings, models, views, URLs.
- **`frontend/src/components/`**: React UI, rendering, interactivity (React Flow).
- **`frontend/src/index.css`**: Global design variables and Tailwind layers.
- **`tests/`**: Python unit/integration/E2E tests.

## 3. Architecture & Implementation Guidelines

### Frontend (UI/UX & Performance)
- **Aesthetics**: Premium Catppuccin Macchiato palette (`ctp-crust`, `ctp-mantle`, `ctp-surface0/1`), minimalist typographic controls (pipe-separated `|`), and Framer Motion Toast notifications. High-fidelity PNG exports exclude UI controls (`pointer-events-auto`).
- **Interactivity**: Double-clicking nodes/links navigates directly to their Nautobot detail pages. Layouts are saved via `/api/plugins/nautobot_topology/topology/<pk>/layout/`.
- **Data Discovery**: 
  - **BGP**: Discover peerings via `nautobot-bgp-models` (use `source_ip` to identify endpoints).
  - **LAG**: Reconstruct physical links into `port-channel` entities in frontend if LAG membership detected.
  - **Cable Discovery**: 
    - **Recursive Fetching**: Uses `/api/plugins/nautobot_topology/topology/<id>/devices/` to find all devices in Site/Location hierarchy (recursive).
    - **Scannable Filter**: Devices without a Primary IP are filtered out by default in the frontend.
    - **Simulator**: Hybrid simulation mode enabled via `discovery_simulator_enabled` in `nautobot_config.py`.
      - **Frontend**: Adds a "✨ Discovery Simulator" device with hardcoded mock results.
      - **Backend**: The `discover_neighbors` API returns simulated neighbors for *any* device using database lookups of nearby devices, bypassing SSH connectivity.
- **Performance (10k+ nodes)**:
  - Pre-calculate `deviceMap` and `linkMap` in `useMemo` (O(1) lookups). NEVER use `.find()` on hot paths.
  - Use structured rank grids for datasets > 500 nodes instead of Dagre.
  - Separate topology processing (`topoNodes`, `topoEdges`) from high-frequency interactive updates using `useEffect` reconciliation.
  - Use React Flow's `onlyRenderVisibleElements={true}` and implement Level of Detail (LOD) zoom thresholds to cull DOM nodes.
- **Edge Aggregation**: In high-density sites (> 1000 links), multiple cables between the same node pair are aggregated into a single visual edge with a count label (e.g., "x12 Cables").
- **Leaf Stacking (ClusterNode)**: For sites with > 1000 nodes, all "leaf" nodes (exactly 1 neighbor) are automatically grouped into a `ClusterNode` (e.g., "Devices on Switch-01"). This prevents massive horizontal sprawl by collapsing thousands of leaf devices into single interactive clusters.
- **Layout Sprawl**: To prevent horizontal graphs from exceeding massive dimensions (> 10k pixels), implement grid-based wrapping for nodes within the same rank when count exceeds 50.
- **Edge Routing**: To prevent links from passing through node boxes, use a 4-handle system (Top, Bottom, Left, Right).

### Backend & Database (Nautobot 3.1.1)
- **Persistence**: Topology node positions are stored in the `TopologyLayout` database model (O2O with `Location`). The API `/layout/` endpoint manages this.
- **Development**: Use `docker-compose` with the volume mount `./nautobot_topology:/usr/local/lib/python3.14/site-packages/nautobot_topology` for real-time backend updates.
- **Compatibility**: Python 3.11-3.14. PostgreSQL 14+. Django 5.2 (`indexes` instead of `index_together`, `assertQuerySetEqual`).
- **Tree Queries**: ALWAYS evaluate `site.descendants()` querysets using `list(...values_list('id', flat=True))` to avoid PostgreSQL CTE subquery errors.
- **Grouping Logic**: Unconnected devices are aggregated by location. Identification of Access Points (APs) for grouping and stacking is controlled by the `ap_role_name` plugin setting. For high-density sites, leaf stacking is applied generically to all device types via `ClusterNode` to maintain layout readability.
- **Layout Ranks**: 0 (Firewall/Cloud) to 8 (Generic). Dagre layout uses `ranker: 'network-simplex'` to force top-to-bottom flow regardless of link direction.

## 4. Testing Standards (80% Coverage Required)
- **Backend**: Execute via `uv run invoke test`. Follow Nautobot's official API testing framework standards.
  - **Permissions**: When testing Nautobot `ObjectPermission`, be aware that DRF's `force_authenticate` or Django's `force_login` may not always pick up model-level permission changes in the same test session without a user re-fetch/re-authentication.
- **Frontend**: Execute via `npm run test --prefix frontend` (Vitest + React Testing Library). Ensure custom hooks have dedicated `.test.ts` files (use `renderHook`).
## 5. Pre-Commit Validation (MANDATORY)
Before committing any changes, you **MUST** run the following checks locally:

1. **Formatting**: `uv run black --check .` (Fix with `uv run black .` if it fails)
2. **Linting**: `uv run flake8 .` (Ensure `.flake8` excludes `.venv` and `.local`)
3. **Backend Logic**: `uv run pytest <relevant_test_file>` (e.g., `nautobot_topology/tests/test_cable_discovery.py`)
4. **Frontend Build**: `uv run invoke build-ui` (if frontend files were modified)

## 6. CI Standards (GitHub Actions)
- **Linting**: Every push MUST pass `black --check .` and `flake8 .`.
- **Exclusions**: Ensure `.flake8` ignores `.venv` and `.local` to prevent scanning all external packages.
- **Dependencies**: All runtime dependencies (e.g., `netmiko`, `ntc-templates`, `requests`) MUST be declared in `pyproject.toml`.
- **Versions**: The plugin version in `nautobot_topology/__init__.py` MUST match `pyproject.toml` and `tests/test_plugin.py`.
- **Settings**: CI uses `nautobot_config` as the `DJANGO_SETTINGS_MODULE`. Ensure `PYTHONPATH=.` is set in the environment.
