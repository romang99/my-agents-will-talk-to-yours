import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoutPrompt, parseScout } from '../server/agents/scout.js';

test('scoutPrompt embeds the name, hints, and evidence-first rules', () => {
  const p = scoutPrompt('Petra Novak', 'QUT, urban planning');
  assert.ok(p.includes('Petra Novak'));
  assert.ok(p.includes('QUT, urban planning'));
  assert.ok(p.includes('"sources"'), 'requires a sources field');
  assert.ok(p.toLowerCase().includes('leave fields empty rather than guessing'));
});

test('parseScout coerces a realistic response, filters bogus families, clamps seniority', () => {
  const raw = `Here is the profile:\n\`\`\`json\n${JSON.stringify({
    name: '  Petra Novak ',
    title: 'Associate Professor',
    institution: 'QUT',
    unit: 'School of Architecture',
    country: 'Australia',
    seniority: 9,
    field: 'Urban planning',
    methods: ['GIS', ''],
    methodFamilies: ['quantitative', 'made-up-family'],
    interests: ['digital twins'],
    reflections: ['Cities buy twins nobody governs.'],
    collaborationStyle: '',
    orcid: '0000-0001-2345-6789',
    sources: ['https://example.edu/profile', ''],
    notes: 'Two academics share this name; picked the QUT one.',
  })}\n\`\`\``;
  const d = parseScout(raw);
  assert.equal(d.name, 'Petra Novak');
  assert.equal(d.seniority, 4, 'seniority clamped to 1-4');
  assert.deepEqual(d.methodFamilies, ['quantitative'], 'unknown families dropped');
  assert.deepEqual(d.methods, ['GIS'], 'empty lines dropped');
  assert.deepEqual(d.sources, ['https://example.edu/profile']);
  assert.ok(d.notes.includes('share this name'));
});

test('parseScout rejects a draft without a name', () => {
  assert.throws(() => parseScout('{"title": "Professor"}'), /no name/);
});
