import { z } from 'zod';

/**
 * Detachable Alexa remote config — MatPlay is a REMOTE, nothing more.
 *
 * No SmartHome skill, no Lambda, no public HTTPS needed.
 * 100% `alexa-remote2` (same private API as the Alexa mobile app):
 *  - OUTBOUND MatPlay -> Echo: pause/stop only, so competing Spotify audio
 *    is silenced when MatPlay plays. play/next/previous/volume are NEVER
 *    forwarded — they would drive the Echo's own player (wrong content,
 *    "Spotify remote" feel). Volume keys control the local decoder only.
 *  - INBOUND REMOVED: Alexa/voice can no longer control the MatPlay stream.
 *    No voice-history polling, no utterance replay, no transport injection.
 *
 * Audible MatPlay-on-Echo path is the private Bluetooth link (auto-managed
 * below). Nothing else may claim the Echo while MatPlay owns it.
 */
export const AlexaConfigSchema = z.object({
  /** Master switch. OFF = module never imported, zero timers/sockets. */
  enabled: z.boolean().default(false),
  /** Target Echo ("Kitchen", serial, or "" = first controllable device). */
  device: z.string().max(128).default(''),
  /** Must match the Amazon domain the cookie was captured on. */
  amazonPage: z
    .string()
    .regex(/^amazon\.[a-z.]{2,24}$/)
    .default('amazon.com'),
  /**
   * When true, MatPlay silences competing Echo audio (pause/stop only).
   * Audible MatPlay-on-Echo is the private Bluetooth link, never a
   * forwarded Spotify command.
   */
  mirrorToEcho: z.boolean().default(true),
  /**
   * Bluetooth MAC of the Echo for the private link (e.g. "AA:BB:CC:DD:EE:FF").
   * Empty = auto-discover by matching the `device` name among paired
   * bluetoothctl devices. Only this MAC is ever connected/disconnected —
   * earphones and other devices are never touched.
   */
  bluetoothMac: z.string().max(32).default(''),
});

export type AlexaConfig = z.infer<typeof AlexaConfigSchema>;

export function defaultAlexaConfig(): AlexaConfig {
  return {
    enabled: false,
    device: '',
    amazonPage: 'amazon.com',
    mirrorToEcho: true,
    bluetoothMac: '',
  };
}

export type AlexaConnectionState =
  | 'off'
  | 'starting'
  | 'needs-login'
  | 'ready'
  | 'error';

export type AlexaStatus = {
  state: AlexaConnectionState;
  detail?: string;
  deviceCount?: number;
};

/** Outbound-only remote actions. play/next/previous are accepted by the
 *  type but never sent by MatPlay (see mirror policy in App). */
export type AlexaRemoteAction = 'play' | 'pause' | 'next' | 'previous' | 'stop';
