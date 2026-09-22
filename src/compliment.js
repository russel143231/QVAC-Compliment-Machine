// QVAC Compliment Machine — core logic.
// completion() writes one personalized, genuine compliment based on a
// name and an optional mood/trait the user provides. Kept short and
// safe with a light output guard; no claims about real-world facts are
// ever made, so there's nothing here that needs fact-grounding.

import { completion } from "@qvac/sdk";

function looksUnusable(text) {
  if (!text || text.trim().length === 0) return true;
  if (text.length > 220) return true;
  const bad = ["i cannot", "i can't", "as an ai", "i'm not able"];
  const lower = text.toLowerCase();
  return bad.some((phrase) => lower.includes(phrase));
}

const FALLBACK = (name) => `${name}, the way you keep showing up for the things that matter to you is genuinely admirable.`;

export async function generateCompliment(modelId, name, trait) {
  const traitLine = trait
    ? `They are especially proud of, or working on: ${trait}.`
    : "";

  const run = completion({
    modelId,
    history: [
      {
        role: "system",
        content:
          "Write one warm, specific, genuine-sounding compliment (1-2 sentences) " +
          "addressed directly to the person by name. Avoid generic flattery, avoid " +
          "physical appearance comments, keep it about character, effort, or growth.",
      },
      {
        role: "user",
        content: `Their name is ${name}. ${traitLine} Write the compliment.`,
      },
    ],
    stream: true,
    completionOpts: { temperature: 0.8, maxTokens: 70 },
  });

  let text = "";
  for await (const token of run.tokenStream) text += token;
  text = text.trim().replace(/^["']|["']$/g, "");

  return looksUnusable(text) ? FALLBACK(name) : text;
}
