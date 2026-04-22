# Antigravity Agent Workflow & Context Guide
**Nautobot Topology Map Development**

## 0. Workflow Maintenance
**CRITICAL**: Always evaluate if new decisions, architectural findings, or project directives warrant an update to this very file (`docs/agent_workflow.md`). You must ensure this document is kept fully up to date by explicitly evaluating if anything should be added, edited, or deleted whenever addressing a new task. This makes picking up future conversations significantly easier.

### Nautobot 3.1.1 Compatibility Notes
- **Django 5.2 Upgrade:** Nautobot 3.1.x uses Django 5.2. Ensure no legacy `index_together` is used in models (migrated to `indexes` in Django 4.0+, required in 5.2).
- **Test Assertions:** Deprecated `assertQuerysetEqual` was removed; use `assertQuerySetEqual`.
- **Database:** PostgreSQL 14+ is mandatory. Our `docker-compose.yml` uses 15, so it's compliant.
- **Tree Queries:** The workaround of evaluating `site.descendants()` querysets to a list `list(...values_list('id', flat=True))` remains critical for Postgres performance and avoiding CTE-related subquery errors in Nautobot 2.x and 3.x.
- **Python Support:** The plugin supports Python 3.11 through 3.14. The development and test environment is locked to **Python 3.14** in the `Dockerfile` to ensure forward compatibility with latest library features.
## 1. Project Directory Mapping (Where to Work)
Always apply your modifications contextually utilizing this topology:
- **`nautobot_topology/api/`**: Make changes here for ALL data fetching logic, data modeling overlays, REST payload formatting (physical, logical, and port-channel link types), group aggregations, and backend calculations.
- **`frontend/src/components/`**: Edit files here for all visual layout rendering, interactivity (React Flow), UI components, or map features.
- **`frontend/src/index.css`**: Modify this for global frontend design variables or raw layer styling.
- **`nautobot_topology/` (Root)**: Core Plugin settings, navigation extensions, URL structures, forms, templates, or base views.
- **`tests/`**: Test modules for executing Python unit/integration/E2E workflows.

## 0.5 Context Management & Continuity
**CRITICAL**: Long conversations can lead to performance degradation or "context drift."
1. **Monitor Context**: If the conversation becomes excessively long or complex (indicated by slow response times or many tool iterations), you **MUST** suggest to the USER to start a new conversation.
2. **State Transition Summary**: Before concluding a high-context conversation, provide a summary of:
   - **Current State**: What features are completed and verified?
   - **Open Issues**: What is left to do?
   - **Environment State**: Any calibrated paths or tool installations (e.g., `uv` path) that the next agent will need.
   - **Key Files**: Which files were the primary focuses?

## 1.5 Environment Configuration & Self-Service Setup
**CRITICAL**: The agent's shell environment is minimal and may lack critical binaries. You MUST follow this setup logic at the start of each session:

1. **Search & Calibrate**: Check for existing binaries in common locations:
   ```bash
   export PATH="$HOME/.local/bin:/usr/local/bin:/opt/homebrew/bin:$PATH"
   ```
2. **Missing Tools (Self-Service)**: If a tool is still missing after calibration:
   - **`uv`**: If `which uv` fails, install it immediately (non-interactive):
     `curl -LsSf https://astral.sh/uv/install.sh | sh`
   - **`node`/`npm`**: If missing, check if `nvm` or `brew` is available to install them.
   - **`docker`**: If missing, report to the user (do not attempt to install Docker automagically).

Key Binary Locations (for reference):
- **`uv`**: `$HOME/.local/bin/uv`
- **`docker` / `docker-compose`**: `/usr/local/bin/`
- **`node` / `npm`**: `/opt/homebrew/bin/` OR `$(which node)`

## 2. Standard Development Workflow
When instructed to make changes to the Toplogy Map, **do not manually type out bash commands**. You must utilize the centralized build matrix via Python `uv` & `invoke` workflows.

### Invoke Command Matrix
The `tasks.py` file dictates operations. Run commands smoothly via `uv run invoke [task_name]`. 
*Ensure PATH calibrated (see Section 1.5) before execution.*

### 3. Performance & Scalability (10k+ Nodes)
- **10k Support:** The platform supports rendering 10k+ nodes by removing artificial safety guards and implementing performance-first layout fallbacks.
- **Backend Optimization:** 
    - Recursive location lookups and efficient counting are used for dashboard accuracy.
    - **CRITICAL**: In Nautobot 2.x, always evaluate `site.descendants()` querysets using `list(...values_list('id', flat=True))` before using them in `__in` filters for other models (e.g. `Device.objects.filter(location_id__in=location_ids)`). Using the raw queryset in a subquery can trigger `ProgrammingError: missing FROM-clause entry for table "__tree"` due to CTE handling in Postgres.
    - API responses for 10k nodes/15k links should be ~1.5s / 7MB.
- **Frontend Optimization:**
    - **Centered Grid Fallback:** Datasets > 500 nodes skip Dagre and use a centered square grid layout (e.g., $100 \times 100$) to prevent browser thread locking.
    - **O(1) Lookups:** Always pre-calculate `deviceMap` and `linkMap` in a top-level `useMemo` for any UI components that require data resolution (tooltips, edge metrics). NEVER use `.find()` on hot paths or during render.
    - **LOD & Zoom:** Use `minZoom: 0.001` to allow fitting massive grids. Higher detail (LOD 1-3) is only rendered when zoomed in.
    - **LOD Update Separation:** Decouple LOD state updates from the main initialNodes generation logic to prevent redundant processing of the entire node/edge array on every zoom threshold transition.
    - **Object Pruning:** Edges are converted to 'straight' lines for $links > 2,000$ and hidden entirely at very low zoom levels ($zoom < 0.2$).
    - **DOM Efficiency:** `onlyRenderVisibleElements={true}` is enabled in React Flow for high-count stability.
    - **Data-Style Sync Decoupling:** For high-frequency interactive updates (e.g., hover highlighting) or live metrics, separate topology processing into discrete `topoNodes` and `topoEdges` memos. Use a `Map`-based reconciliation pattern in `useEffect` to sync data changes while preserving user-initiated layouts/positions.
    - **Popup Limiting:** For aggregate groups or stacks containing thousands of items, limit rendered list items to 100 with a "Show more" link to prevent DOM overhead from crashing the tab.
- **Debug Mode:** HUD (with LOD metrics) is gated by `debug: True` in `nautobot_config.py` and throttled to prevent render loops.
- **PTY Workaround:** In headless environments (like Docker), some `invoke` tasks using Pty may fail. If `pty=True` in `tasks.py` causes an `OSError`, run commands directly via `docker compose exec`.

## 3. Test-Driven Development (TDD) Requirement
**CRITICAL**: The user requires **80% test coverage**. Testing is non-negotiable and MUST be part of the coding cycle.

### Testing Types
We evaluate our logic via three different paradigms:
- **Unit Tests**: Narrow tests focused on pinpoint functional assertions isolated from the database.
- **Integration Tests**: Verification of our API serializers and ViewSets against Nautobot database mocks schemas.
- **E2E Tests**: Full validation ensuring our React rendering successfully binds to backend state manipulation.

### Testing Standard Operating Procedures
- For comprehensive application testing inside Nautobot, rigorously follow the official framework standards here: 
  [Nautobot App API Testing Framework](https://docs.nautobot.com/projects/core/en/stable/development/apps/api/testing/)
- To guide structural plugin decisions/app extensions, review the primary guidelines here: 
  [Nautobot App Development Guidelines](https://docs.nautobot.com/projects/core/en/stable/development/apps/)
- After implementing Python features or altering backend behaviors, you must create or augment tests ensuring the coverage requirement is met.

Verify tests pass using:
`uv run invoke test`
*(This invoke task implicitly runs `pytest` equipped with `--cov-fail-under=80` checks!).*

### Frontend Testing (Vitest & RTL)
- **Framework:** [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/).
- **Execution:** `npm run test --prefix frontend`.
- **Standards:** All newly extracted hooks and utility functions MUST have dedicated `.test.ts` files. Aim for 80% coverage on complex data-processing hooks (like `useTopologyData`).
- **Mocking:** Use `renderHook` for custom hooks and `@testing-library/jest-dom` for component assertions.

## 4. Modular Architecture (DeviceFlow)
The `DeviceFlow.tsx` component is an orchestrator. Logic is separated into:
- **Layout/Persistence Logic**: User-defined node positions are synchronized via a flat-mapping REST API:
    - **GET/POST Path**: `/api/plugins/nautobot_topology/topology/<pk>/layout/`
    - **Data Format**: `{ "device_id": { "x": float, "y": float } }`
    - **Persistence**: Layouts are stored infinitely in the Nautobot cache layer.
- **Modern UI Aesthetics**: This map uses an advanced glassmorphic styling system (`slate-900/40`, `backdrop-blur-md`), ultra-rounded corners (`rounded-3xl`), and minimalist typographic controls.
    - **Typographic Selectors**: Prefer pipe-separated (`|`) text-only selectors over boxed buttons for a premium, integrated look.
    - **Integrated Notifications**: Use in-app `Toast` notifications (Framer Motion) instead of browser `alert()` popups for layout save/error events.
- **High-Fidelity Export**: Built-in PNG snapshotting uses `html-to-image` with UI-isolation.
    - **Isolation Logic**: The export pipeline filters out elements marked with `pointer-events-auto` (controls, buttons) to produce clean, presentation-ready diagrams.
- **Deep Discovery (BGP/LAG)**: 
    - **BGP Schema**: BGP peerings are discovered via the `nautobot-bgp-models` plugin. Use `source_ip` to identify peer endpoints.
    - **LAG Aggregation**: Physical links are reconstructed into `port-channel` entities in the frontend if LAG membership is detected in the payload.
- Ensure links encompassing interactive layouts bind to entire list items cleanly via background hover highlights (`hover:bg-slate-700/80 hover:text-white no-underline`) without forcing default blue text properties.
- **Deep Navigation**: Double-clicking nodes or links triggers a direct redirect to their respective primary detail pages in the Nautobot UI.
- **Aggressive Browser Caches**: React chunks loaded into the base `dashboard.html` template bypass cache locks natively, so updating code then utilizing `build-ui` should organically update the user instance upon their next page load.

## 5. Mandatory Validation & QA
**CRITICAL**: You must never assume changes work as intended without execution. Every change cycle must conclude with a validation phase:
1. **Frontend Changes**: Immediately run `uv run invoke build-ui` to recompile assets and ensure the build completes without errors.
2. **Backend Validation:** Always run `uv run invoke test` after logic changes.
3. **Self-Service Execution:** Use `uv run invoke start` to ensure the persistent environment is ready.
4. **Mandatory Container Persistence:** Always prefer `docker compose exec` (the default in updated `tasks.py`) over `run --rm` to maintain session state and prevent database contention in the local development environment.
5. **Task Completion**: Before responding "Done", run `uv run invoke test`. If the environment prevents full test execution (e.g., missing Docker or Database), explicitly state what was verified statically and what requires final user validation in their local environment.
6. **Data Verification**: When creating data generation scripts (e.g., `scratch/`), verify they can be imported and the logic is sound, even if the runtime environment lacks a live Nautobot database.
