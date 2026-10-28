// util.js — small shared helpers.

/** Extract the first JSON object from an LLM response that may wrap it in
 * markdown fences or prose. Throws if nothing parseable is found. */
export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      return JSON.parse(candidate.slice(start, end + 1));
    }
    throw new Error(`No parseable JSON in LLM response: ${text.slice(0, 200)}`);
  }
}
