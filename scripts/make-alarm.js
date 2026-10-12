#!/usr/bin/env node
/**
 * Builds assets/sounds/ck_alarm.wav from assets/sounds/ck_chime.wav.
 *
 * The short ck_chime.wav (~0.95s) stays the daily-reminder sound. Todo alarms
 * need something longer and more insistent, so this repeats the chime with a
 * short silence between each repeat, producing an "ringing" loop of ~4.7s that
 * keeps drawing attention until the user snoozes or dismisses it.
 *
 * Run: npm run make-alarm
 */

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "assets", "sounds", "ck_chime.wav");
const OUT = path.join(__dirname, "..", "assets", "sounds", "ck_alarm.wav");
const REPEATS = 4;
const GAP_SECONDS = 0.3;

function readChunks(buffer) {
  const chunks = {};
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4).trim();
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    chunks[id] = {
      data: buffer.subarray(start, start + size),
      size,
    };
    offset = start + size + (size % 2);
  }
  return chunks;
}

function wavHeader({ channels, sampleRate, bitsPerSample, dataSize }) {
  const blockAlign = channels * (bitsPerSample / 8);
  const byteRate = sampleRate * blockAlign;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "ascii");
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8, "ascii");
  header.write("fmt ", 12, "ascii");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "ascii");
  header.writeUInt32LE(dataSize, 40);
  return header;
}

function main() {
  const source = fs.readFileSync(SRC);
  const chunks = readChunks(source);
  const fmt = chunks.fmt;
  const data = chunks.data;
  if (!fmt || !data) {
    throw new Error(`Could not parse ${path.basename(SRC)} as a WAV file.`);
  }

  const channels = fmt.data.readUInt16LE(2);
  const sampleRate = fmt.data.readUInt32LE(4);
  const bitsPerSample = fmt.data.readUInt16LE(14);
  const bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
  const silence = Buffer.alloc(Math.round(bytesPerSecond * GAP_SECONDS));

  const parts = [];
  for (let i = 0; i < REPEATS; i += 1) {
    parts.push(data.data);
    if (i < REPEATS - 1) parts.push(silence);
  }
  const alarmData = Buffer.concat(parts);

  const header = wavHeader({
    channels,
    sampleRate,
    bitsPerSample,
    dataSize: alarmData.length,
  });
  fs.writeFileSync(OUT, Buffer.concat([header, alarmData]));

  const duration = alarmData.length / bytesPerSecond;
  console.log(
    `Wrote ${path.relative(process.cwd(), OUT)} (${REPEATS} chimes, ` +
      `${duration.toFixed(2)}s, ${channels}ch @ ${sampleRate}Hz/${bitsPerSample}bit)`,
  );
}

main();
