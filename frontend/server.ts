import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Simulated persistence for topology layouts
  const layoutStore: Record<string, any> = {};

  app.get("/api/plugins/topology-nexus/topology/:siteId/layout", (req, res) => {
    const { siteId } = req.params;
    res.json(layoutStore[siteId] || { nodes: [] });
  });

  app.post("/api/plugins/topology-nexus/topology/:siteId/layout", (req, res) => {
    const { siteId } = req.params;
    const { nodes } = req.body;
    layoutStore[siteId] = { nodes };
    res.json({ status: "success" });
  });

  // Simulated Nautobot API Endpoints
  app.get("/api/plugins/topology-nexus/topology", (req, res) => {
    // In a real plugin, this would query Nautobot's ORM (Device, Interface, Cable, etc.)
    res.json({
      status: "success",
      data: {
        nodes: [
          { id: 'dev-1', name: 'nyc-core-01', role: 'Core Switch', site: 'New York' },
          { id: 'dev-2', name: 'nyc-core-02', role: 'Core Switch', site: 'New York' },
          { id: 'dev-3', name: 'nyc-dist-01', role: 'Distribution', site: 'New York' },
        ],
        links: [
          { source: 'dev-1', target: 'dev-2', type: 'physical' },
          { source: 'dev-1', target: 'dev-3', type: 'physical' },
        ]
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "../nautobot_topology/static/nautobot_topology")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "../nautobot_topology/static/nautobot_topology", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Nautobot Topology Server running on http://localhost:${PORT}`);
  });
}

startServer();
