import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { buildSeed } from './seed.js';
import { uid } from '../util/ids.js';

const SCHEMA_VERSION = 4;
const COLLECTIONS = ['users', 'clients', 'accounts', 'conversations', 'drafts', 'activity'];

function matches(doc, query = {}) {
  return Object.entries(query).every(([k, v]) => {
    if (Array.isArray(v)) return v.includes(doc[k]);
    return doc[k] === v;
  });
}

class MemoryCollection {
  constructor(name, docs = []) {
    this.name = name;
    this.docs = new Map(docs.map((d) => [d.id, structuredClone(d)]));
  }
  async find(query = {}) {
    return [...this.docs.values()].filter((d) => matches(d, query)).map((d) => structuredClone(d));
  }
  async findOne(query = {}) {
    return (await this.find(query))[0] || null;
  }
  async findById(id) {
    const d = this.docs.get(id);
    return d ? structuredClone(d) : null;
  }
  async insert(doc) {
    const copy = structuredClone({ id: doc.id || uid(this.name), ...doc });
    copy.id = doc.id || copy.id;
    this.docs.set(copy.id, copy);
    scheduleSave();
    return structuredClone(copy);
  }
  async update(id, patch) {
    const doc = this.docs.get(id);
    if (!doc) return null;
    Object.assign(doc, structuredClone(patch), { updatedAt: new Date().toISOString() });
    scheduleSave();
    return structuredClone(doc);
  }
  async remove(id) {
    const ok = this.docs.delete(id);
    if (ok) scheduleSave();
    return ok;
  }
  async count(query = {}) {
    return (await this.find(query)).length;
  }
}

let saveTimer = null;
let memoryMode = true;

function filePath() {
  return path.join(config.dataDir, 'db.json');
}

function scheduleSave() {
  if (!memoryMode || !config.persist) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      fs.mkdirSync(config.dataDir, { recursive: true });
      const payload = { v: SCHEMA_VERSION, savedAt: new Date().toISOString() };
      for (const name of COLLECTIONS) payload[name] = [...store[name].docs.values()];
      fs.writeFileSync(filePath(), JSON.stringify(payload));
    } catch (err) {
      console.warn('[db] could not persist snapshot:', err.message);
    }
  }, 250);
}

function loadSnapshot() {
  try {
    if (process.env.RESET_DATA) return null;
    const raw = fs.readFileSync(filePath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.v !== SCHEMA_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

function seedMemory() {
  const seed = buildSeed();
  for (const name of COLLECTIONS) {
    store[name] = new MemoryCollection(name, seed[name] || []);
  }
}

export const store = {};

export async function initDb() {
  if (config.mongoUri) {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(config.mongoUri);
    await client.connect();
    const db = client.db();
    memoryMode = false;
    for (const name of COLLECTIONS) {
      store[name] = wrapMongo(db.collection(name), name);
    }

    const users = store.users.collection;
    if ((await users.countDocuments()) === 0) {
      const seed = buildSeed();
      for (const name of COLLECTIONS) {
        if (seed[name]?.length) await store[name].insertMany(seed[name]);
      }
      console.log('[db] MongoDB seeded with sample data');
    }
    console.log('[db] connected to MongoDB');
    return { backend: 'mongodb' };
  }

  memoryMode = true;
  const snapshot = loadSnapshot();
  if (snapshot) {
    for (const name of COLLECTIONS) {
      store[name] = new MemoryCollection(name, snapshot[name] || []);
    }
    console.log(`[db] restored snapshot (${new Date(snapshot.savedAt).toLocaleString()})`);
  } else {
    seedMemory();
    console.log('[db] seeded in-memory store with sample conversations');
  }
  return { backend: 'memory' };
}

export async function reseed() {
  if (!memoryMode) throw new Error('reseed() only supported on the memory backend');
  clearTimeout(saveTimer);
  try {
    fs.rmSync(filePath(), { force: true });
  } catch {}
  seedMemory();
  return true;
}

export function backend() {
  return memoryMode ? 'memory' : 'mongodb';
}

function wrapMongo(col, name) {
  const mapDoc = (d) => {
    if (!d) return d;
    const { _id, ...rest } = d;
    return { ...rest, id: String(_id) };
  };
  const mapQuery = (q = {}) => {
    const out = { ...q };
    if ('id' in out) {
      out._id = out.id;
      delete out.id;
    }
    return out;
  };
  return {
    name,
    collection: col,
    async find(query = {}) {
      const docs = await col.find(mapQuery(query)).toArray();
      return docs.map(mapDoc);
    },
    async findOne(query = {}) {
      const d = await col.findOne(mapQuery(query));
      return mapDoc(d);
    },
    async findById(id) {
      return mapDoc(await col.findOne({ _id: id }));
    },
    async insert(doc) {
      const copy = { ...doc, id: doc.id || uid(name) };
      await col.insertOne({ ...copy, _id: copy.id });
      return copy;
    },
    async update(id, patch) {
      const { id: _ignored, _id, ...rest } = patch;
      await col.updateOne({ _id: id }, { $set: { ...rest, updatedAt: new Date().toISOString() } });
      return this.findById(id);
    },
    async remove(id) {
      const r = await col.deleteOne({ _id: id });
      return r.deletedCount > 0;
    },
    async count(query = {}) {
      return col.countDocuments(mapQuery(query));
    },
    async insertMany(docs) {
      for (const d of docs) await this.insert(d);
    },
  };
}
