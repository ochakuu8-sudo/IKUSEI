/** Quiet material foley, synthesized after a user gesture without media requests. */
let context: AudioContext | undefined;
let noise: AudioBuffer | undefined;

type PaperAction = "lift" | "sign" | "place" | "book" | "rest";

function disconnect(nodes: AudioNode[]) {
  for (const node of nodes) {
    try {
      node.disconnect();
    } catch {
      // A suspended or disposed audio device must not interrupt the game.
    }
  }
}

function noiseBuffer(audio: AudioContext) {
  if (noise?.sampleRate === audio.sampleRate) return noise;
  noise = audio.createBuffer(1, Math.ceil(audio.sampleRate * 0.5), audio.sampleRate);
  const samples = noise.getChannelData(0);
  // Fixed noise avoids conspicuously different clicks on repeated interactions.
  let seed = 48127;
  for (let i = 0; i < samples.length; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    samples[i] = (seed >>> 0) / 2147483648 - 1;
  }
  return noise;
}

export function paperSound(volume: number, action: PaperAction = "lift") {
  if (!Number.isFinite(volume) || volume <= 0 || typeof AudioContext === "undefined")
    return;
  try {
    if (!context || context.state === "closed") context = new AudioContext();
    const audio = context;
    const level = Math.min(100, volume) / 100;
    const play = () => {
      if (audio.state !== "running") return;
      const now = audio.currentTime;
      const buffer = noiseBuffer(audio);

      const rustle = (
        delay: number,
        duration: number,
        pitch: number,
        endPitch: number,
        strength: number,
        attack = 0.008,
      ) => {
        const nodes: AudioNode[] = [];
        try {
          const source = audio.createBufferSource();
          nodes.push(source);
          const filter = audio.createBiquadFilter();
          nodes.push(filter);
          const gain = audio.createGain();
          nodes.push(gain);
          const start = now + delay;
          source.buffer = buffer;
          filter.type = "bandpass";
          filter.Q.value = 0.65;
          filter.frequency.setValueAtTime(pitch, start);
          filter.frequency.exponentialRampToValueAtTime(endPitch, start + duration);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(level * strength, start + attack);
          gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);
          gain.gain.linearRampToValueAtTime(0, start + duration + 0.004);
          source.connect(filter).connect(gain).connect(audio.destination);
          source.onended = () => disconnect(nodes);
          source.start(start, delay % 0.2);
          source.stop(start + duration + 0.005);
        } catch {
          disconnect(nodes);
        }
      };

      const contact = (
        delay: number,
        duration: number,
        pitch: number,
        strength: number,
      ) => {
        const nodes: AudioNode[] = [];
        try {
          const source = audio.createOscillator();
          nodes.push(source);
          const gain = audio.createGain();
          nodes.push(gain);
          const start = now + delay;
          source.type = "sine";
          source.frequency.setValueAtTime(pitch, start);
          source.frequency.exponentialRampToValueAtTime(pitch * 0.55, start + duration);
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(level * strength, start + 0.003);
          gain.gain.exponentialRampToValueAtTime(0.00001, start + duration);
          gain.gain.linearRampToValueAtTime(0, start + duration + 0.004);
          source.connect(gain).connect(audio.destination);
          source.onended = () => disconnect(nodes);
          source.start(start);
          source.stop(start + duration + 0.005);
        } catch {
          disconnect(nodes);
        }
      };

      switch (action) {
        case "lift":
          // The edge frees first; a lower paper flex follows as it rises.
          rustle(0, 0.105, 1700, 2600, 0.105, 0.012);
          rustle(0.046, 0.085, 950, 600, 0.045);
          break;
        case "place":
          contact(0, 0.075, 160, 0.024);
          rustle(0, 0.05, 1000, 700, 0.105, 0.004);
          rustle(0.028, 0.075, 2300, 1400, 0.04);
          break;
        case "sign":
          // Three nib strokes, then contact at the visual seal's 280 ms mark.
          rustle(0, 0.063, 2800, 2000, 0.055, 0.005);
          rustle(0.074, 0.056, 2400, 3200, 0.045, 0.004);
          rustle(0.145, 0.085, 2900, 1800, 0.055, 0.005);
          contact(0.28, 0.11, 135, 0.038);
          rustle(0.28, 0.065, 720, 380, 0.13, 0.003);
          rustle(0.299, 0.08, 1500, 850, 0.03);
          break;
        case "book":
          // Soft leather movement and a small fan of pages, without a chime.
          contact(0, 0.07, 110, 0.018);
          rustle(0, 0.135, 350, 650, 0.09, 0.02);
          rustle(0.065, 0.1, 1700, 2200, 0.065, 0.015);
          rustle(0.112, 0.09, 2100, 1300, 0.045);
          rustle(0.153, 0.085, 1300, 800, 0.03);
          break;
        case "rest":
          rustle(0, 0.17, 750, 320, 0.085, 0.025);
          break;
      }
    };
    if (audio.state === "running") play();
    else
      void audio
        .resume()
        .then(play)
        .catch(() => {});
  } catch {
    // Audio is optional; reading, accepting, and saving must always continue.
  }
}
