import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const normalise = (s) => String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const privatePath = /^(?:data\/(?:archive\/|runs\/(?!\.gitkeep$)|(?:custom-researchers|profile-overrides|triggers)\.json$)|transcripts\/(?!README\.md$))/;
const secretPath = /(?:^|\/)(?:\.env(?:$|\.(?!example$))|id_rsa$|id_ed25519$|[^/]+\.(?:pem|p12|key)$)/i;
const secret = /(?:sk-ant-[A-Za-z0-9_-]{20,}|sk-(?:proj-)?[A-Za-z0-9_-]{30,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;

/** Check a complete Git tree, not just the latest changed files. */
export function auditSnapshot(files) {
  const errors = [];
  const copyright = files.get('LICENSE')?.match(/Copyright \(c\) \d{4} (.+)/)?.[1];
  const authorNames = copyright?.split(/ and /).map(normalise).filter(Boolean) ?? [];
  let seedIds = new Set();
  const fail = (file, reason) => errors.push(`${file}: ${reason}`);

  function profile(p, file) {
    if (p.synthetic !== true || typeof p.id !== 'string' || !p.id.startsWith('synthetic-')) {
      fail(file, 'published profiles must be explicitly synthetic and use synthetic-* IDs');
    }
    if (authorNames.includes(normalise(p.name)) || authorNames.includes(normalise(p.id))) {
      fail(file, 'an author identity is being used as a persona');
    }
  }

  if (files.has('server/data/researchers.json')) {
    try {
      const seed = JSON.parse(files.get('server/data/researchers.json'));
      if (!Array.isArray(seed.researchers) || !seed.researchers.length) throw new Error('missing researchers');
      for (const p of seed.researchers) {
        profile(p, 'server/data/researchers.json');
        if (seedIds.has(p.id)) fail('server/data/researchers.json', 'duplicate persona ID');
        seedIds.add(p.id);
      }
      for (const edge of seed.collaborations ?? []) {
        if (!seedIds.has(edge.source) || !seedIds.has(edge.target)) fail('server/data/researchers.json', 'unknown collaboration endpoint');
      }
      if (!copyright || !files.get('LICENSE').includes('MIT License')) fail('LICENSE', 'MIT attribution must be retained');
    } catch {
      fail('server/data/researchers.json', 'invalid seed dataset');
    }
  }

  function walk(value, file) {
    if (!value || typeof value !== 'object') return;
    if (value.synthetic === false) fail(file, 'real-person marker in published JSON');
    if (typeof value.name === 'string' && Array.isArray(value.interests) && Array.isArray(value.methods)) profile(value, file);
    if (Array.isArray(value.pair) && value.provider) {
      const pair = value.pair;
      if (value.provider.name !== 'demo') fail(file, 'live run provider in published JSON');
      if (pair.length !== 2 || pair.some(id => !seedIds.has(id) || !id.startsWith('synthetic-'))) fail(file, 'run pair is not from the synthetic seed pool');
      const personas = value.personas ?? {};
      if (Object.keys(personas).length !== 2 || Object.keys(personas).some(id => !pair.includes(id))) fail(file, 'run persona snapshots do not match its synthetic pair');
      if (pair.some(id => personas[id]?.id !== id || personas[id]?.synthetic !== true)) fail(file, 'run lacks explicitly synthetic persona snapshots');
    }
    for (const item of Object.values(value)) walk(item, file);
  }

  for (const [file, content] of files) {
    if (privatePath.test(file)) fail(file, 'private runtime state or raw transcript is tracked');
    if (secretPath.test(file) || secret.test(content)) fail(file, 'credential filename or token-like content');
    if (!file.endsWith('.json')) continue;
    try {
      const value = JSON.parse(content);
      walk(value, file);
      if (authorNames.some(name => normalise(content).includes(name))) fail(file, 'author identity in published JSON data');
      if (file.startsWith('data/examples/') && !(Array.isArray(value.pair) && value.provider)) fail(file, 'example is not an auditable demo run');
    } catch {
      fail(file, 'invalid JSON');
    }
  }
  return [...new Set(errors)];
}

function main() {
  const args = process.argv.slice(2);
  const staged = args.length === 1 && args[0] === '--staged';
  if (args.length && !staged && (args.length !== 2 || args[0] !== '--ref')) throw new Error('Usage: node tools/check-publishing.mjs [--staged | --ref COMMIT]');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const git = (...argv) => execFileSync('git', ['-C', root, ...argv], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const errors = [];
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
  const working = new Map(tracked.map(file => [file, staged ? git('show', `:${file}`) : fs.existsSync(path.join(root, file)) ? fs.readFileSync(path.join(root, file), 'utf8') : '']));
  for (const error of auditSnapshot(working)) errors.push(`${staged ? 'staged snapshot' : 'working tree'}: ${error}`);
  const commits = staged ? [] : git('rev-list', ...(args.length ? [args[1]] : ['--all'])).trim().split('\n').filter(Boolean);
  for (const commit of commits) {
    const files = git('ls-tree', '-r', '--name-only', '-z', commit).split('\0').filter(Boolean);
    const snapshot = new Map(files.map(file => [file, git('show', `${commit}:${file}`)]));
    for (const error of auditSnapshot(snapshot)) errors.push(`${commit.slice(0, 7)}: ${error}`);
  }
  if (errors.length) {
    console.error(`Publishing check failed (${errors.length} issue(s)):\n${errors.join('\n')}`);
    process.exitCode = 1;
  } else {
    console.log(`Publishing check passed: ${tracked.length} tracked files; ${commits.length} reachable commits; synthetic-only profiles and demo-only runs.`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
