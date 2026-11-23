const fs = require('node:fs');
const path = require('node:path');
const { createApp } = require('./app');
const JsonStore = require('./models/JsonStore');

const PORT = Number(process.env.PORT) || 3000;
const STORAGE = (process.env.STORAGE || 'file').toLowerCase();
const DATA_FILE = path.join(__dirname, 'data', 'posts.json');

let store;
if (STORAGE === 'memory') {
  // RAM only: start from the shipped sample posts, never write to disk
  const seed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  store = new JsonStore({ seed });
} else {
  store = new JsonStore({ filePath: DATA_FILE });
}

const app = createApp({ store });

store
  .init()
  .then(() => {
    const server = app.listen(PORT, () => {
      console.log(`Quillpad Blog API running on http://localhost:${PORT}  (storage: ${STORAGE})`);
    });
    const shutdown = () => server.close(() => process.exit(0));
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  })
  .catch((err) => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
