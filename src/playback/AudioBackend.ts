import type { Track } from '../library/types.js';

/**
 * Playback abstraction. The UI and scanner only ever depend on this
 * interface — the concrete output mechanism (ffplay today, mpv or a PCM
 * pipeline tomorrow) is an isolated detail.
 */
export interface AudioBackend {
  load(track: Track): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(volume: number): Promise<void>;
  getPosition(): Promise<number>;
  getDuration(): Promise<number | undefined>;
  /** Kill the underlying process. stop() only halts output. */
  destroy(): Promise<void>;
}
