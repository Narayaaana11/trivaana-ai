import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const elevenlabs = new ElevenLabsClient();
export default elevenlabs;
