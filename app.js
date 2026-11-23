const express = require('express');
const { createPostModel } = require('./models/postModel');
const createPostController = require('./controllers/postController');
const createPostRoutes = require('./routes/postRoutes');
const apiKeyGuard = require('./middleware/apiKey');
const { requestId, requestLogger } = require('./middleware/requestLogger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

/**
 * App factory – takes its dependencies (store, api key) as arguments,
 * which keeps server.js tiny and makes the app easy to test.
 */
function createApp({ store, apiKey = process.env.API_KEY, logRequests = true }) {
  const app = express();
  app.disable('x-powered-by');

  // ---- global middleware ----
  app.use(requestId);
  if (logRequests) app.use(requestLogger);
  app.use(express.json({ limit: '100kb' }));

  // ---- wiring: store -> model -> controller -> routes ----
  const model = createPostModel(store);
  const controller = createPostController(model);

  // ---- utility routes ----
  app.get('/', (req, res) => {
    res.json({
      name: 'Quillpad Blog API',
      version: '1.0.0',
      endpoints: {
        posts: '/posts',
        stats: '/posts/stats',
        trash: '/posts/trash',
        health: '/health',
        openapi: '/docs',
      },
    });
  });
  app.get('/health', (req, res) => res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }));
  app.get('/docs', (req, res) => res.json(require('./docs/openapi.json')));

  // ---- resource routes ----
  app.use('/posts', createPostRoutes(controller, { guard: apiKeyGuard(apiKey) }));

  // ---- 404 + error handling (must be last) ----
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
