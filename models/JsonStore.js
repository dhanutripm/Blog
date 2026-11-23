const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * JsonStore – tiny persistence layer.
 *  - filePath given  -> data lives in memory AND is saved to a JSON file
 *                       (written to a temp file, then renamed, so a crash
 *                       never leaves a half-written posts.json)
 *  - filePath = null -> pure in-memory array (optionally pre-filled with `seed`)
 * Writes are queued so two requests can never write at the same moment.
 */
class JsonStore {
  constructor({ filePath = null, seed = [] } = {}) {
    this.filePath = filePath;
    this.seed = seed;
    this.items = null;
    this._initPromise = null;
    this._writeChain = Promise.resolve();
  }

  init() {
    if (!this._initPromise) this._initPromise = this._load();
    return this._initPromise;
  }

  async _load() {
    if (!this.filePath) {
      this.items = structuredClone(this.seed);
      return;
    }
    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed = JSON.parse(raw || '[]');
      if (!Array.isArray(parsed)) throw new Error(`${this.filePath} must contain a JSON array`);
      this.items = parsed;
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
      this.items = structuredClone(this.seed); // first run: start from the seed
      await this.persist();
    }
  }

  /** The live array – callers may mutate it, then call persist(). */
  async getAll() {
    await this.init();
    return this.items;
  }

  async persist() {
    if (!this.filePath) return;
    const snapshot = JSON.stringify(this.items, null, 2);
    const job = this._writeChain.then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const tmp = `${this.filePath}.${process.pid}.tmp`;
      await fs.writeFile(tmp, snapshot);
      await fs.rename(tmp, this.filePath);
    });
    this._writeChain = job.catch(() => {}); // keep the chain alive after a failure
    return job;
  }
}

module.exports = JsonStore;
