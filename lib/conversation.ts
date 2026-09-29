// Sohbet modu için sürekli mikrofon dinleme. Basit bir ses etkinliği algılayıcısı (VAD)
// konuşmanın başını ve sonunu bulur; her konuşma parçası 16 kHz mono WAV (base64) olarak verilir.

const TARGET_RATE = 16000;
const END_SILENCE_MS = 650; // bu kadar sessizlik olunca parça biter
const START_SPEECH_MS = 150; // bu kadar ses olunca konuşma başlamış sayılır
const MIN_SPEECH_MS = 450; // bundan kısa sesler (öksürük, tık) gönderilmez
const MAX_SEGMENT_MS = 15000;
const PRE_ROLL_MS = 300; // konuşmanın başı kırpılmasın

export type CaptureState = 'listening' | 'speech' | 'paused';

export interface CaptureController {
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

interface CaptureOptions {
  onSegment: (wavBase64: string) => void;
  onState?: (state: CaptureState) => void;
  onLevel?: (level: number) => void; // 0..1, ekrandaki dalga göstergesi için
}

const encodeWavBase64 = (samples: Float32Array, rate: number) => {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
};

// Ses kartı 16 kHz vermezse basit ortalama ile aşağı örnekle
const downsample = (input: Float32Array, fromRate: number): Float32Array => {
  if (fromRate === TARGET_RATE) return input;
  const ratio = fromRate / TARGET_RATE;
  const out = new Float32Array(Math.floor(input.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j++) sum += input[j];
    out[i] = sum / Math.max(1, end - start);
  }
  return out;
};

export const startConversationCapture = async (opts: CaptureOptions): Promise<CaptureController> => {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
  });

  let ctx: AudioContext;
  try {
    ctx = new AudioContext({ sampleRate: TARGET_RATE });
  } catch {
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
  const rate = ctx.sampleRate;
  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(2048, 1, 1);
  const frameMs = (2048 / rate) * 1000;

  let paused = false;
  let inSpeech = false;
  let noiseFloor = 0.008;
  let loudMs = 0;
  let silentMs = 0;
  let speechMs = 0;
  let segment: Float32Array[] = [];
  const preRoll: Float32Array[] = [];
  const preRollFrames = Math.ceil(PRE_ROLL_MS / frameMs);

  const setState = (s: CaptureState) => opts.onState?.(s);

  const finishSegment = () => {
    const chunks = segment;
    const spoken = speechMs;
    segment = [];
    inSpeech = false;
    loudMs = silentMs = speechMs = 0;
    setState(paused ? 'paused' : 'listening');
    if (spoken < MIN_SPEECH_MS) return;
    const total = chunks.reduce((n, c) => n + c.length, 0);
    const merged = new Float32Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(c, off); off += c.length; }
    opts.onSegment(encodeWavBase64(downsample(merged, rate), TARGET_RATE));
  };

  processor.onaudioprocess = (e) => {
    if (paused) return;
    const input = new Float32Array(e.inputBuffer.getChannelData(0));
    let sum = 0;
    for (let i = 0; i < input.length; i++) sum += input[i] * input[i];
    const rms = Math.sqrt(sum / input.length);
    opts.onLevel?.(Math.min(1, rms * 12));

    const threshold = Math.max(0.012, noiseFloor * 3);
    const loud = rms > threshold;

    if (!inSpeech) {
      // Sessizken ortam gürültüsünü öğren
      if (!loud) noiseFloor = noiseFloor * 0.95 + rms * 0.05;
      preRoll.push(input);
      if (preRoll.length > preRollFrames) preRoll.shift();
      loudMs = loud ? loudMs + frameMs : 0;
      if (loudMs >= START_SPEECH_MS) {
        inSpeech = true;
        segment = [...preRoll];
        preRoll.length = 0;
        speechMs = loudMs;
        silentMs = 0;
        setState('speech');
      }
      return;
    }

    segment.push(input);
    if (loud) {
      speechMs += frameMs;
      silentMs = 0;
    } else {
      silentMs += frameMs;
    }
    const lengthMs = segment.length * frameMs;
    if (silentMs >= END_SILENCE_MS || lengthMs >= MAX_SEGMENT_MS) finishSegment();
  };

  source.connect(processor);
  // ScriptProcessor'ın çalışması için çıkışa bağlı olmalı; ses çıkmaz (çıkış tamponu sıfır)
  processor.connect(ctx.destination);
  setState('listening');

  return {
    // Çeviri seslendirilirken kendi sesimizi dinlememek için duraklatılır
    pause: () => {
      paused = true;
      segment = [];
      inSpeech = false;
      loudMs = silentMs = speechMs = 0;
      setState('paused');
    },
    resume: () => {
      paused = false;
      preRoll.length = 0;
      setState('listening');
    },
    stop: () => {
      paused = true;
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      ctx.close().catch(() => {});
    },
  };
};
