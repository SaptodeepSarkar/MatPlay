import { z } from 'zod';

/**
 * Detachable Alexa connector config.
 *
 * No SmartHome skill, no Lambda, no public HTTPS needed.
 * Hybrid is 100% `alexa-remote2` (same private API as the Alexa mobile app):
 *  - OUTBOUND MatPlay -> Echo: sendCommand(play/pause/next/previous/volume)
 *  - INBOUND  Echo -> MatPlay: poll voice history (getCustomerHistoryRecords)
 *    for utterances containing "matplay" and map them to local transport.
 */
export const AlexaConfigSchema = z.object({
  /** Master switch. OFF = module never imported, zero timers/sockets. */
  enabled: z.boolean().default(false),
  /** Target Echo ("Kitchen", serial, or "" = first controllable device). */
  device: z.string().default(''),
  /** Must match the Amazon domain the cookie was captured on. */
  amazonPage: z.string().default('amazon.com'),
  /** Voice-history poll interval. 3500-5000ms avoids rate limits. */
  pollMs: z.number().min(2000).max(15000).default(4000),
  /** When true, "pause on matplay / next on matplay" drives local transport. */
  respondToVoice: z.boolean().default(true),
  /** When true, local space/n/p also mirrors to the Echo. */
  mirrorToEcho: z.boolean().default(true),
});

export type AlexaConfig = z.infer<typeof AlexaConfigSchema>;

export function defaultAlexaConfig(): AlexaConfig {
  return {
    enabled: false,
    device: '',
    amazonPage: 'amazon.com',
    pollMs: 4000,
    respondToVoice: true,
    mirrorToEcho: true,
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
  lastVoiceText?: string;
  lastVoiceAt?: number;
  deviceCount?: number;
};

/** Minimal transport surface — same shape as PresenceControls. */
export type AlexaTransport = {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  stop: () => void;
};

export type AlexaRemoteAction = 'play' | 'pause' | 'next' | 'previous' | 'stop';
