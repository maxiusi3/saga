// 生成一个0.5秒、单声道、16kHz、16-bit PCM 的简短WAV测试文件（440Hz正弦波）
// 输出到 packages/web/test.wav

const fs = require('fs');
const path = require('path');

function generateSineWav({ durationSec = 0.5, sampleRate = 16000, freq = 440, amplitude = 0.3 }) {
  const numSamples = Math.floor(durationSec * sampleRate);
  const bytesPerSample = 2; // 16-bit PCM
  const blockAlign = 1 * bytesPerSample; // mono
  const byteRate = sampleRate * blockAlign;

  // PCM 数据
  const dataBuffer = Buffer.alloc(numSamples * bytesPerSample);
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.sin(2 * Math.PI * freq * t);
    const s = Math.max(-1, Math.min(1, sample * amplitude));
    const int16 = Math.round(s * 32767);
    dataBuffer.writeInt16LE(int16, i * 2);
  }

  // WAV 头（RIFF/WAVE, fmt , data）
  const fmtChunkSize = 16; // PCM
  const audioFormat = 1; // PCM
  const numChannels = 1; // mono
  const subchunk2Size = dataBuffer.length;
  const chunkSize = 4 + (8 + fmtChunkSize) + (8 + subchunk2Size);

  const header = Buffer.alloc(44);
  header.write('RIFF', 0); // ChunkID
  header.writeUInt32LE(chunkSize, 4); // ChunkSize
  header.write('WAVE', 8); // Format

  header.write('fmt ', 12); // Subchunk1ID
  header.writeUInt32LE(fmtChunkSize, 16); // Subchunk1Size
  header.writeUInt16LE(audioFormat, 20); // AudioFormat
  header.writeUInt16LE(numChannels, 22); // NumChannels
  header.writeUInt32LE(sampleRate, 24); // SampleRate
  header.writeUInt32LE(byteRate, 28); // ByteRate
  header.writeUInt16LE(blockAlign, 32); // BlockAlign
  header.writeUInt16LE(bytesPerSample * 8, 34); // BitsPerSample

  header.write('data', 36); // Subchunk2ID
  header.writeUInt32LE(subchunk2Size, 40); // Subchunk2Size

  return Buffer.concat([header, dataBuffer]);
}

(function main() {
  const outPath = path.resolve(__dirname, '../packages/web/test.wav');
  const wav = generateSineWav({});
  fs.writeFileSync(outPath, wav);
  console.log('WAV written:', outPath, 'size:', wav.length, 'bytes');
})();

