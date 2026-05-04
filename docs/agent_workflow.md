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
- **UI Patterns**:
  - **Scrollability**: Use `.custom-scrollbar` class for data-dense containers (dropdowns, tables) to ensure consistent, non-intrusive scrolling.
  - **Tables**: Apply `whitespace-nowrap` to table cells containing long network names (Discovery Results) to facilitate clean horizontal scrolling.
  - **Popups**: Standardize expanded node popups (GroupNode, ClusterNode) to `w-80` (320px) and `rounded-2xl` for layout parity with tooltips.
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
    - **Parsing Logic**:
      - Uses `netmiko` with `use_textfsm=True` for structured output.
      - Robust key mapping in `_extract_neighbor_data` handles inconsistencies across different NTC templates (e.g., `NEIGHBOR_NAME` vs `DESTINATION_HOST`).
      - **Protocol Merging**: Automatically merges results from LLDP and CDP. If an interface is found via LLDP, it takes precedence; otherwise, CDP results are used as fallback to avoid duplicate entries for the same link.
    - **Matching Logic**:
      - Matches remote devices using:
        1. Exact case-insensitive Name match
        2. FQDN stripping (handles multiple dots/domains)
        3. Primary IP match (IPv4/IPv6 via Django Q objects)
        4. MAC address match (searching all device interfaces)
      - MAC address handling: `strip_domain_safe` recognizes and preserves common MAC formats (e.g., `aaaa.bbbb.cccc`) instead of treating them as FQDNs.
- **Performance (10k+ nodes)**:
  - Pre-calculate `deviceMap` and `linkMap` in `useMemo` (O(1) lookups). NEVER use `.find()` on hot paths.
  - Use structured rank grids for datasets > 500 nodes instead of Dagre.
  - Separate topology processing (`topoNodes`, `topoEdges`) from high-frequency interactive updates using `useEffect` reconciliation.
  - Use React Flow's `onlyRenderVisibleElements={true}` and implement Level of Detail (LOD) zoom thresholds to cull DOM nodes.
- **Edge Aggregation**: In high-density sites (> 1000 links), multiple cables between the same node pair are aggregated into a single visual edge with a count label (e.g., "x12 Cables").
- **Leaf Stacking (ClusterNode)**: For sites with > 1000 nodes, all "leaf" nodes (exactly 1 neighbor) are automatically grouped into a `ClusterNode` (e.g., "Devices on Switch-01"). This prevents massive horizontal sprawl by collapsing thousands of leaf devices into single interactive clusters.
- **GroupNode**: 
  - **Unconnected**: Site-level grouping for unconnected devices or APs (controlled by `ap_role_name`).
  - **Connected APs**: Leaf Access Points connected to a single upstream switch are automatically aggregated into a `GroupNode` tied directly to that switch. This preserves connectivity context while drastically reducing visual clutter in wireless-heavy sites.
- **Layout Sprawl**: To prevent horizontal graphs from exceeding massive dimensions (> 10k pixels), implement grid-based wrapping for nodes within the same rank when count exceeds 50.
- **Edge Routing**: To prevent links from passing through node boxes, use a 4-handle system (Top, Bottom, Left, Right).

### Backend & Database (Nautobot 3.1.1)
- **Persistence**: Topology node positions are stored in the `TopologyLayout` database model (O2O with `Location`). The API `/layout/` endpoint manages this.
- **Development**: Use `docker-compose` with the volume mount `./nautobot_topology:/usr/local/lib/python3.12/site-packages/nautobot_topology` for real-time backend updates.
- **Compatibility**: Python 3.11-3.12 (Python 3.14 experimental/unstable with Django templates). PostgreSQL 14+. Django 5.2 (`indexes` instead of `index_together`, `assertQuerySetEqual`).
- **Tree Queries**: ALWAYS evaluate `site.descendants()` querysets using `list(...values_list('id', flat=True))` to avoid PostgreSQL CTE subquery errors.
- **Grouping Logic**: Unconnected devices are aggregated by location. Identification of Access Points (APs) for grouping and stacking is controlled by the `ap_role_name` plugin setting. For high-density sites, leaf stacking is applied generically to all device types via `ClusterNode` to maintain layout readability.
- **Layout Ranks**: 0 (Firewall/Cloud) to 8 (Generic). Dagre layout uses `ranker: 'network-simplex'` to force top-to-bottom flow regardless of link direction.
- **Modular ViewSets**: To maintain API scalability, monolithic `retrieve` actions must be decomposed into focused private helper methods (e.g., `_get_cable_links`, `_build_topology_nodes`).
- **Discovery Optimization**: Neighbor matching must avoid O(N*M) iterative component lookups. Use `_build_component_map` to pre-calculate interface/port maps into a single dictionary for O(1) matching during discovery.
- **Caching**: Implement context-aware caching for remote device lookups and their respective component maps during batch discovery operations to minimize database load.

## 4. Testing Standards (80% Coverage Required)
- **Backend**: Execute via `uv run invoke test`. Follow Nautobot's official API testing framework standards.
  - **Permissions**: When testing Nautobot `ObjectPermission`, be aware that DRF's `force_authenticate` or Django's `force_login` may not always pick up model-level permission changes in the same test session without a user re-fetch/re-authentication.
  - **Mocking Consistency**: When patching models (e.g. `Interface`) for API tests, always patch the import path used in `api/views.py` (e.g. `nautobot_topology.api.views.Interface`) rather than the raw model path to ensure consistency between the code and the mock.
- **Frontend**: Execute via `npm run test --prefix frontend` (Vitest + React Testing Library). Ensure custom hooks have dedicated `.test.ts` files (use `renderHook`).
