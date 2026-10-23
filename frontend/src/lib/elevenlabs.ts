import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

/**
 * ElevenLabs Client instance.
 * Reads ELEVENLABS_API_KEY from environment.
 */
export const elevenlabs = new ElevenLabsClient();
export default elevenlabs;
