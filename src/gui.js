#!/usr/bin/env node
// QVAC Compliment Machine — GUI mode.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  loadModel,
  unloadModel,
  textToSpeech,
  LLAMA_3_2_1B_INST_Q4_0,
  TTS_MINI_V1_EN_PARLER_TTS_Q8_0,
} from "@qvac/sdk";
import { generateCompliment } from "./compliment.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? Number(process.env.PORT) : 29299;
const PUBLIC_DIR = path.join(__dirname, "..", "public");
// Parler-TTS (GGML) outputs 44.1 kHz mono PCM natively.
const PARLER_SAMPLE_RATE = 44100;

// textToSpeech() resolves result.buffer to a plain array of int16 PCM
// samples, not an encoded audio file — this builds a real playable WAV
// from it (found while testing: the naive `Buffer.from(result.audio)`
// this app started with doesn't exist on the response shape at all).
function pcmToWav(samples, sampleRate) {
  const audioData = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) {
    const value = Math.max(-32768, Math.min(32767, Math.round(samples[i] ?? 0)));
    audioData.writeInt16LE(value, i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + audioData.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(audioData.length, 40);
  return Buffer.concat([header, audioData]);
}

function serveStatic(res) {
  const html = fs.readFileSync(path.join(PUBLIC_DIR, "index.html"));
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

async function main() {
  console.log("▸ Loading language + TTS models on-device...");
  const modelId = await loadModel({ modelSrc: LLAMA_3_2_1B_INST_Q4_0 });
  const ttsModelId = await loadModel({
    modelSrc: TTS_MINI_V1_EN_PARLER_TTS_Q8_0,
    modelConfig: { ttsEngine: "parler", voice: "Laura", seed: 42, topK: 1 },
  });
  console.log("▸ Models ready.");

  const server = http.createServer(async (req, res) => {
    if (req.method === "GET" && req.url === "/") return serveStatic(res);

    if (req.method === "POST" && req.url === "/api/compliment") {
      try {
        const { name, trait } = await readBody(req);
        if (!name) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing name" }));
          return;
        }
        const compliment = await generateCompliment(modelId, name, trait);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ compliment }));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    if (req.method === "POST" && req.url === "/api/speak") {
      try {
        const { text } = await readBody(req);
        if (!text) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing text" }));
          return;
        }
        const result = textToSpeech({ modelId: ttsModelId, text, inputType: "text", stream: false });
        const samples = await result.buffer;
        res.writeHead(200, { "Content-Type": "audio/wav" });
        res.end(pcmToWav(samples, PARLER_SAMPLE_RATE));
      } catch (error) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
      return;
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  });

  server.listen(PORT, () => {
    console.log(`▸ QVAC Compliment Machine GUI ready at http://localhost:${PORT}`);
  });

  const shutdown = async () => {
    console.log("\n▸ Shutting down...");
    server.close();
    await unloadModel({ modelId });
    await unloadModel({ modelId: ttsModelId });
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error("✖", error);
  process.exit(1);
});
