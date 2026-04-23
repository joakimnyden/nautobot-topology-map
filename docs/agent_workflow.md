# Antigravity Agent Workflow & Context Guide
**Nautobot Topology Map Development**

## 1. Core Workflow (MANDATORY FOR EVERY TASK)
Follow these steps strictly for *every* task to ensure consistency and stability:

1. **Environment Setup & Calibration**: 
   - Check binaries: `export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"`
   - If `uv` is missing: `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - Use `docker compose exec` instead of `run --rm` to maintain session state.

2. **Execute via Invoke**: 
   - NEVER type raw bash commands for standard development tasks. 
   - Use `uv run invoke [task_name]` (e.g., `start`, `stop`, `test`, `build-ui`).

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
- **Aesthetics**: Premium glassmorphic styling (`slate-900/40`, `backdrop-blur-md`), minimalist typographic controls (pipe-separated `|`), and Framer Motion Toast notifications. High-fidelity PNG exports exclude UI controls (`pointer-events-auto`).
- **Interactivity**: Double-clicking nodes/links navigates directly to their Nautobot detail pages. Layouts are saved via `/api/plugins/nautobot_topology/topology/<pk>/layout/`.
- **Data Discovery**: 
  - **BGP**: Discover peerings via `nautobot-bgp-models` (use `source_ip` to identify endpoints).
  - **LAG**: Reconstruct physical links into `port-channel` entities in frontend if LAG membership detected.
- **Performance (10k+ nodes)**:
  - Pre-calculate `deviceMap` and `linkMap` in `useMemo` (O(1) lookups). NEVER use `.find()` on hot paths.
  - Use structured rank grids for datasets > 500 nodes instead of Dagre.
  - Separate topology processing (`topoNodes`, `topoEdges`) from high-frequency interactive updates using `useEffect` reconciliation.
  - Use React Flow's `onlyRenderVisibleElements={true}` and implement Level of Detail (LOD) zoom thresholds to cull DOM nodes.

### Backend & Database (Nautobot 3.1.1)
- **Persistence**: Topology node positions are stored in the `TopologyLayout` database model (O2O with `Location`). The API `/layout/` endpoint manages this.
- **Development**: Use `docker-compose` with the volume mount `./nautobot_topology:/usr/local/lib/python3.14/site-packages/nautobot_topology` for real-time backend updates.
- **Compatibility**: Python 3.11-3.14. PostgreSQL 14+. Django 5.2 (`indexes` instead of `index_together`, `assertQuerySetEqual`).
- **Tree Queries**: ALWAYS evaluate `site.descendants()` querysets using `list(...values_list('id', flat=True))` to avoid PostgreSQL CTE subquery errors.
- **Layout Ranks**: 0 (Firewall/Cloud) to 8 (Generic). Dagre layout uses `ranker: 'network-simplex'` to force top-to-bottom flow regardless of link direction.

## 4. Testing Standards (80% Coverage Required)
- **Backend**: Execute via `uv run invoke test`. Follow Nautobot's official API testing framework standards.
  - **Permissions**: When testing Nautobot `ObjectPermission`, be aware that DRF's `force_authenticate` or Django's `force_login` may not always pick up model-level permission changes in the same test session without a user re-fetch/re-authentication.
- **Frontend**: Execute via `npm run test --prefix frontend` (Vitest + React Testing Library). Ensure custom hooks have dedicated `.test.ts` files (use `renderHook`).
