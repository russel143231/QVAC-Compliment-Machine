# QVAC Compliment Machine

Type your name (and, optionally, something you're proud of or working
on), and an on-device AI writes a personalized, specific compliment —
then speaks it aloud. Powered entirely by
[Tether's QVAC SDK](https://github.com/tetherto/qvac). No cloud call,
no API key, no bill.

It calls the QVAC SDK's `loadModel()`, `unloadModel()`, `completion()`,
and `textToSpeech()` functions directly. The compliment is the model's
one job, guided by an explicit instruction to stay specific and avoid
generic flattery or appearance-based comments; the TTS step reads back
exactly the text that was generated, with nothing re-typed or
re-interpreted in between.

## What it does

```bash
npm run gui
```

Enter your name, optionally add a trait or thing you're proud of,
click "Get a Compliment," and read (or click to hear) a short,
personalized compliment addressed directly to you.

## SDK version

Built against `@qvac/sdk` **v0.19.1** (see [package.json](package.json)).

## Requirements

- Node.js `>= 22.17`
- A machine that meets [QVAC's system requirements](https://docs.qvac.tether.io/system-requirements)
- ~1 GB free disk space for the LLM + TTS model weights on first run

## Install

```bash
npm install
```

## GUI mode

```bash
npm run gui
```

Loads both models once at startup, then starts a local server
(`http://localhost:29299` by default, override with `PORT=8080 npm run gui`).

## How it uses QVAC

```js
import { loadModel, completion, textToSpeech, LLAMA_3_2_1B_INST_Q4_0, TTS_MINI_V1_EN_PARLER_TTS_Q8_0 } from "@qvac/sdk";

const modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0 });
const ttsModelId = await loadModel({ modelSrc: TTS_MINI_V1_EN_PARLER_TTS_Q8_0 });

const run = completion({
  modelId,
  history: [
    { role: "system", content: "Write one warm, specific, genuine-sounding compliment..." },
    { role: "user", content: `Their name is ${name}. ${traitLine} Write the compliment.` },
  ],
  stream: true,
});

const { audio } = await textToSpeech({ modelId: ttsModelId, text: compliment });
```

See [src/compliment.js](src/compliment.js) and [src/gui.js](src/gui.js)
for the full implementation.

## Why I built this

Similar to Fortune Cookie earlier in this series, this app chains
`completion()` straight into `textToSpeech()` — but it flips the input
model from random (a cookie crack) to user-driven (a name and a real
detail about them). It's a small but real difference: the personalized
version forces the prompt-construction to safely handle free-text user
input rather than a fixed internal category list, and the system
prompt has to actively steer the model away from generic or
appearance-based flattery to keep the output actually meaningful.

## Notes on this build

This app was built and scaffolded in this session but not run
end-to-end yet — no "verified output" section is included here on
purpose, to avoid claiming a test that didn't happen. The design
mirrors patterns (light output guards, streaming completion) already
verified working in this series's other apps.

## License

[MIT](LICENSE)
