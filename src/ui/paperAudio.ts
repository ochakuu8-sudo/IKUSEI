/** Short paper foley, synthesized locally after a user gesture. No network/audio assets. */
let context: AudioContext | undefined;
export function paperSound(
  volume: number,
  action: "lift" | "sign" | "place" = "lift",
) {
  if (volume <= 0 || typeof AudioContext === "undefined") return;
  try {
    context ??= new AudioContext();
    const audio = context;
    const play = () => {
      const duration = action === "sign" ? 0.24 : 0.12;
      const buffer = audio.createBuffer(
        1,
        Math.ceil(audio.sampleRate * duration),
        audio.sampleRate,
      );
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++)
        samples[i] =
          (Math.random() * 2 - 1) *
          (action === "sign"
            ? Math.max(0, Math.sin((i / audio.sampleRate) * 95))
            : 1);
      const source = audio.createBufferSource();
      const filter = audio.createBiquadFilter();
      const gain = audio.createGain();
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = action === "place" ? 900 : 2100;
      filter.Q.value = 0.65;
      const now = audio.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(
        (Math.min(100, volume) / 100) * 0.13,
        now + 0.014,
      );
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter).connect(gain).connect(audio.destination);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
      source.start(now);
      source.stop(now + duration);
    };
    if (audio.state === "running") play();
    else
      void audio
        .resume()
        .then(() => {
          if (audio.state === "running") play();
        })
        .catch(() => {});
  } catch {
    /* Unavailable audio must never block reading or accepting a letter. */
  }
}
