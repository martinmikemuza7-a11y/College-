import dotenv from 'dotenv';
dotenv.config();

// Ensure DISABLE_HMR is active in AI Studio dev environment to prevent failed WebSocket connections
if (!process.env.DISABLE_HMR) {
  process.env.DISABLE_HMR = 'true';
}

import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initDb } from './server/db.js';
import { router as apiRouter } from './server/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();

  // Initialize persistent database
  initDb();

  // Body parsers
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request logger
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.path}`);
    }
    next();
  });

  // Mount API endpoints
  app.use('/api', apiRouter);

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'Study Buddy AI',
      timestamp: new Date().toISOString(),
      geminiKeyConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  if (!isProd) {
    // Mount Vite middleware in development mode
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted in dev mode');
  } else {
    // Serve production static build
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    } else {
      console.warn('[Server] Production dist folder not found. Please run "npm run build" first.');
    }
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err.type === 'entity.too.large' || err.status === 413) {
      console.warn('[Server 413] Payload too large for upload request');
      return res.status(413).json({
        error: 'Upload payload exceeds server limit (max 30MB per document). Please compress or split the document.',
      });
    }
    console.error('[Server Error]', err);
    res.status(err.status || 500).json({ error: err?.message || 'Internal server error' });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Study Buddy AI server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Fatal] Failed to start:', err);
  process.exit(1);
});
