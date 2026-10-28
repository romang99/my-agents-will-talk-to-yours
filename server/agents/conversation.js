// conversation.js — Step 3 (Conversation). Two persona agents alternate turns.
// Each turn is one LLM call: the speaker's persona system prompt + the transcript
// so far + phase-specific guidance. Turns stream to the UI via the onTurn callback.
//
// The conversation is anchored to an opportunity trigger (a call for papers, a
// project brief, a research idea). The agents' job is NOT to invent a joint
// research agenda — it is to recognise whether a genuine collaboration
// opportunity exists between these two researchers, for this trigger, and to
// recommend whether the humans should connect. Without a trigger the same
// question is asked in the open ("is there a genuine basis here at all?"),
// but triggered runs are the intended mode.

import { personaSystemPrompt } from './persona.js';

const DEFAULT_TURNS = 6;

function phaseGuidance(turnIndex, turns, isLast, hasTrigger) {
  const phase = Math.floor((turnIndex / turns) * 3);
  if (isLast) {
    return hasTrigger
      ? 'This is your final turn. Give your recommendation plainly: should the two humans connect about this opportunity — yes or no? If yes: what each side would bring, and what the first contact should be about (an introduction, not a research plan). If no: say so clearly and why. Do not draft research questions or study designs — that is the humans’ work, after they meet.'
      : 'This is your final turn. Give your recommendation plainly: is there a genuine basis for these two researchers to connect — yes or no — and why? Recommend a first contact if yes. Do not draft research questions or study designs — that is the humans’ work, after they meet.';
  }
  if (phase === 0) {
    return hasTrigger
      ? "Opening phase: state honestly whether this opportunity is even relevant to your researcher — it is fine to say it is not. If it is, say what your researcher would concretely bring to it, drawing on their private reflections. Then ask one sharp question about what the other side would bring."
      : "Opening phase: raise what genuinely occupies your researcher right now, drawing on their private reflections — no pleasantries, no profile-restating. Ask one sharp question that a profile page could not answer.";
  }
  if (phase === 1) {
    return hasTrigger
      ? 'Assessment phase: test the complementarity for THIS opportunity. Would a joint response be stronger than either alone — concretely, because of which method, access, data, or perspective on which side? Probe the gaps too: what does the opportunity need that neither of you has? Push back on vague synergy talk — your job is recognition, not invention.'
      : 'Assessment phase: test whether real complementarity exists — which method, access, data, or perspective on each side would the other genuinely need? Push back on vague synergy talk — your job is to recognise a basis for collaboration, not to manufacture one.';
  }
  return hasTrigger
    ? 'Judgment phase: weigh it honestly. Is this a pairing you would stake your researcher’s time on for this opportunity, given everything else on their plate? Say plainly what could kill it — timing, commitment, fit.'
    : 'Judgment phase: weigh it honestly. Would your researcher realistically invest in this connection, given everything else on their plate? Say plainly what could kill it.';
}

export async function runConversation({ a, b, provider, turns = DEFAULT_TURNS, onTurn, trigger = null, transcript = [] }) {
  // `transcript` may already hold turns from an interrupted run — the loop
  // resumes exactly where it stopped.
  for (let i = transcript.length; i < turns; i++) {
    const speaker = i % 2 === 0 ? a : b;
    const other = i % 2 === 0 ? b : a;
    const isLast = i === turns - 1;

    const history = transcript.length
      ? transcript.map((t) => `${t.speakerName}: ${t.text}`).join('\n\n')
      : '(You speak first — there is no transcript yet.)';

    const prompt = [
      `You are in an agent-to-agent conversation with the research agent representing ${other.name} (${other.title}, ${other.field}).`,
      '',
      ...(trigger
        ? [
            `THE OPPORTUNITY ON THE TABLE — your entire conversation is about whether your two researchers should connect over this:`,
            `"${trigger.title}"`,
            trigger.text,
            '',
          ]
        : []),
      'Conversation so far:',
      history,
      '',
      `Guidance for this turn: ${phaseGuidance(i, turns, isLast, Boolean(trigger))}`,
      '',
      `Write your next turn now (as ${speaker.name}'s agent, first person, 150-250 words, no preamble).`,
    ].join('\n');

    const text = await provider.complete({
      system: personaSystemPrompt(speaker),
      prompt,
      maxTokens: 1000,
      meta: { kind: 'turn', speaker, other, turnIndex: i, turns, trigger },
    });

    const turn = {
      index: i,
      speakerId: speaker.id,
      speakerName: speaker.name,
      text,
      at: new Date().toISOString(),
    };
    transcript.push(turn);
    if (onTurn) await onTurn(turn);
  }
  return transcript;
}
