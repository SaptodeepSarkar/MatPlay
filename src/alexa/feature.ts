/**
 * Feature flag for the Echo integration (remote + private Bluetooth link).
 *
 * Default OFF: the Alexa row is hidden from Settings, the connector never
 * starts, and the app behaves as if the feature doesn't exist — while all
 * the code stays in the tree. Opt back in explicitly:
 *
 *   MATPLAY_ENABLE_ALEXA=1 matplay
 */
export const ALEXA_FEATURE_ENABLED = process.env.MATPLAY_ENABLE_ALEXA === '1';
