// synthesizer.js — bridge from Step 3 to Step 4. Reads the full conversation
// transcript and distils it into a structured connection brief the humans can
// validate. The unit of output is the CONNECTION, not a research agenda: did
// the agents recognise a genuine collaboration opportunity between these two
// researchers (for the trigger, when one is set), and should the humans meet?

import { extractJson } from '../util.js';

export async function synthesizeOpportunity({ a, b, transcript, provider, trigger = null }) {
  // The reader is a busy academic deciding whether to send one email. Anchoring
  // the brief on the two PEOPLE, not on the conversation, is what keeps it from
  // becoming a referee report on a dialogue nobody asked about.
  const system =
    'You write a short, plain note to a busy researcher who is deciding whether to email someone they have never met. You have read a conversation between the two researchers\' agents, and you report what it means for the two humans — never what happened in the conversation. You never inflate a weak conversation into an opportunity: if no credible basis for connecting was established, say that plainly. You do not write research questions or study designs — the deliverable is a judgment about whether these two people should meet, and why.';

  const prompt = [
    `Researcher A: ${a.name} — ${a.title}, ${a.field} (${a.institution})`,
    `Researcher B: ${b.name} — ${b.title}, ${b.field} (${b.institution})`,
    ...(trigger ? ['', `The opportunity under discussion: "${trigger.title}" — ${trigger.text}`] : ['', 'No specific opportunity was on the table — this was an open exploration of collaboration potential.']),
    '',
    'Conversation transcript:',
    ...transcript.map((t) => `${t.speakerName}: ${t.text}`),
    '',
    'How to write every piece of text below — this matters as much as the content:',
    `- Write about ${a.name} and ${b.name}, not about the conversation. Say "${b.name} has run an LLM pilot inside a state government" — never "${b.name}'s agent then named the real hole".`,
    '- Never use the words "agent", "transcript", "probe", "conceded", "surfaced", "signal" or "the pairing". The reader does not care how the conversation went; they care what is true about the other person.',
    '- Short sentences. Plain words. One idea per sentence. Say it the way you would in the corridor.',
    '- No stacked abstract nouns, no invented compound terms. Keep their real terms of art; drop anything you would not say out loud.',
    '- If a sentence would read the same for any two academics, delete it.',
    '',
    'Produce a connection brief as JSON only (no prose outside the JSON), with exactly these keys:',
    '{',
    '  "viable": boolean,            // is there a genuine basis for these two to connect' + (trigger ? ' over this opportunity?' : '?'),
    // This is the headline in the findings table and the chart tooltip — it has
    // to fit one line, so the word cap is doing real work.
    `  "title": string,              // ONE short sentence, at most 14 words, naming both sides — e.g. "${b.name}'s expert panels could give ${a.name} the baseline they lack". A plain sentence, not a noun-pile label. Detail belongs in fit_summary, not here.`,
    '  "fit_summary": string,        // 2-3 short sentences: why these two people do or do not fit, in terms of what each of them actually does',
    `  "contributions": { "${a.id}": string, "${b.id}": string },  // what each person would bring${trigger ? ' to this opportunity' : ''} — concrete things, under 60 words each`,
    '  "joint_angle": string | null, // one plain sentence: what a joint effort would be about (a pointer, NOT a research question)',
    '  "first_step": string | null,  // what the first contact between them should cover — under 60 words, an introduction, not a plan',
    '  "relevance": 1-5,             // how relevant the pairing is' + (trigger ? ' to the opportunity' : ' to both agendas'),
    '  "complementarity": 1-5, "feasibility": 1-5,',
    '  "verdict": string             // the recommendation in plain words, under 120 words: connect or not, why, and the one thing that would change the answer',
    '}',
  ].join('\n');

  const raw = await provider.complete({
    system,
    prompt,
    maxTokens: 1500,
    meta: { kind: 'synthesis', a, b, transcript, trigger },
  });
  const brief = extractJson(raw);
  if (typeof brief.viable !== 'boolean' || !brief.title) {
    throw new Error('Synthesizer returned malformed connection brief');
  }
  return brief;
}
