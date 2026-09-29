// Yerel geliştirme / tek sunucu kurulumu. Canlıda API, Vercel'de api/[route].ts ile çalışır.
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { handleRoute } from "./api/[route]";

const app = express();
const PORT = 3000;

app.use(express.json());

app.use("/api/:route", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-app-key");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  const result = await handleRoute(req.params.route, req.method, req.body, req.header("x-app-key"));
  res.status(result.status).json(result.body);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
