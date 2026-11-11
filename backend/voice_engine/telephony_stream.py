"""
TRIVAANA AI: Bidirectional Telephony WebSocket Media Engine (Bolna + Pipecat Pattern)
Handles pure-Python G.711 mu-law <-> PCM16 8kHz conversion, WAV framing,
RMS voice activity detection, barge-in interruption (`clear`), and full-duplex
turn execution over `/api/calls/stream/{call_id}` for Exotel, Twilio, Plivo, and Vobiz.
"""

import base64
import io
import json
import math
import sqlite3
import struct
import uuid
import wave
from typing import Any, Dict, List, Optional

from voice_engine.pipeline import RealtimeVoicePipeline


_MULAW_BIAS = 0x84
_MULAW_CLIP = 32635


def linear_sample_to_mulaw(sample: int) -> int:
    sign = 0x80 if sample < 0 else 0
    if sample < 0:
        sample = -sample
    if sample > _MULAW_CLIP:
        sample = _MULAW_CLIP
    sample += _MULAW_BIAS
    exponent = 7
    mask = 0x4000
    while exponent > 0 and (sample & mask) == 0:
        exponent -= 1
        mask >>= 1
    mantissa = (sample >> (exponent + 3)) & 0x0F
    return (~(sign | (exponent << 4) | mantissa)) & 0xFF


def mulaw_byte_to_linear(u_val: int) -> int:
    u_val = (~u_val) & 0xFF
    t = ((u_val & 0x0F) << 3) + _MULAW_BIAS
    t <<= (u_val & 0x70) >> 4
    return (_MULAW_BIAS - t) if (u_val & 0x80) else (t - _MULAW_BIAS)


_MULAW_DECODE_TABLE = [mulaw_byte_to_linear(i) for i in range(256)]


def mulaw_to_pcm16(data: bytes) -> bytes:
    """Convert 8-bit G.711 mu-law bytes to little-endian signed 16-bit PCM."""
    if not data:
        return b""
    samples = [_MULAW_DECODE_TABLE[b] for b in data]
    return struct.pack(f"<{len(samples)}h", *samples)


def pcm16_to_mulaw(pcm_bytes: bytes) -> bytes:
    """Convert little-endian signed 16-bit PCM to 8-bit G.711 mu-law."""
    count = len(pcm_bytes) // 2
    if count <= 0:
        return b""
    samples = struct.unpack(f"<{count}h", pcm_bytes[: count * 2])
    return bytes(linear_sample_to_mulaw(s) for s in samples)


def pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 8000, channels: int = 1) -> bytes:
    """Wrap raw PCM16 frames in a valid RIFF WAV container for STT APIs."""
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(channels)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm_bytes)
    return buf.getvalue()


def extract_pcm16_from_audio(audio_bytes: bytes) -> bytes:
    """Extract PCM16 payload if wrapped in WAV, otherwise return raw bytes as-is."""
    if len(audio_bytes) >= 44 and audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                return wf.readframes(wf.getnframes())
        except Exception:
            pass
    return audio_bytes


def compute_pcm16_rms(pcm_bytes: bytes) -> float:
    count = len(pcm_bytes) // 2
    if count <= 0:
        return 0.0
    samples = struct.unpack(f"<{count}h", pcm_bytes[: count * 2])
    mean_sq = sum(s * s for s in samples) / count
    return math.sqrt(mean_sq)


DTMF_TERMINATOR = "#"
DTMF_DIGITS = frozenset("0123456789*#ABCD")


class DtmfAccumulator:
    """Bolna-inspired DTMF digit accumulator with '#' terminator or explicit flush."""

    def __init__(self, terminator: str = DTMF_TERMINATOR):
        self._terminator = terminator
        self._digits = ""

    def press(self, digit: str) -> Optional[str]:
        if not isinstance(digit, str):
            return None
        for key in digit:
            if key == self._terminator:
                return self.flush()
            if key in DTMF_DIGITS:
                self._digits += key
        return None

    def flush(self) -> Optional[str]:
        if not self._digits:
            return None
        digits, self._digits = self._digits, ""
        return digits


class TelephonyStreamSession:
    """Stateful bidirectional media session per call WebSocket."""

    def __init__(
        self,
        conn: sqlite3.Connection,
        call_id: str,
        provider: str = "exotel",
        speech_rms_threshold: float = 450.0,
        silence_frames_to_flush: int = 12,
        min_speech_bytes: int = 1600,
    ):
        self.conn = conn
        self.call_id = call_id
        self.provider = (provider or "exotel").lower()
        self.stream_sid: Optional[str] = None
        self.call_sid: Optional[str] = None
        self.speech_rms_threshold = speech_rms_threshold
        self.silence_frames_to_flush = silence_frames_to_flush
        self.min_speech_bytes = min_speech_bytes

        self.audio_buffer = bytearray()
        self.silent_frames = 0
        self.speech_active = False
        self.ai_speaking = False
        self.history: List[Dict[str, str]] = []
        self.barge_in_count = 0
        self.dtmf = DtmfAccumulator()

        self.call_exists, self.tenant_id, self.agent, self.lead_context = self._load_call_context()

    def _load_call_context(self):
        cur = self.conn.cursor()
        cur.execute("SELECT * FROM calls WHERE id = ?", (self.call_id,))
        call = cur.fetchone()
        if not call:
            return False, "tenant_demo_enterprise", {
                "id": "agent_default",
                "name": "Trivaana AI Assistant",
                "system_prompt": "You are a polite, concise voice AI assistant.",
                "language": "en-IN",
                "provider": "sarvam",
                "voice_id": "meera",
            }, None

        tenant_id = call["tenant_id"]
        agent = None
        if call["agent_id"]:
            cur.execute("SELECT * FROM agents WHERE id = ? AND tenant_id = ?", (call["agent_id"], tenant_id))
            row = cur.fetchone()
            if row:
                agent = dict(row)
        if not agent:
            cur.execute("SELECT * FROM agents WHERE tenant_id = ? LIMIT 1", (tenant_id,))
            row = cur.fetchone()
            agent = dict(row) if row else {
                "id": "agent_default",
                "name": "Trivaana AI Assistant",
                "system_prompt": "You are a polite, concise voice AI assistant.",
                "language": call["language"] or "en-IN",
                "provider": "sarvam",
                "voice_id": "meera",
            }
        lead_ctx = {
            "name": call["contact_name"],
            "phone": call["phone"],
            "language": call["language"],
        }
        return True, tenant_id, agent, lead_ctx

    def _encode_outbound_media(self, raw_audio: bytes) -> str:
        pcm = extract_pcm16_from_audio(raw_audio)
        if self.provider in ("twilio", "plivo"):
            carrier_bytes = pcm16_to_mulaw(pcm)
        else:
            carrier_bytes = pcm
        return base64.b64encode(carrier_bytes).decode("ascii")

    def _build_outbound_frames(self, raw_audio: bytes) -> List[Dict[str, Any]]:
        if not raw_audio:
            return []
        payload_b64 = self._encode_outbound_media(raw_audio)
        mark_id = f"trv_{uuid.uuid4().hex[:8]}"
        frames: List[Dict[str, Any]] = [
            {
                "event": "media",
                "streamSid": self.stream_sid or self.call_id,
                "media": {"payload": payload_b64},
            },
            {
                "event": "mark",
                "streamSid": self.stream_sid or self.call_id,
                "mark": {"name": mark_id},
            },
        ]
        self.ai_speaking = True
        return frames

    def handle_event(self, msg: Dict[str, Any]) -> Dict[str, Any]:
        """Process one incoming carrier WebSocket JSON message and return outbound frames + control state."""
        event = (msg.get("event") or "").lower()
        outbound: List[Dict[str, Any]] = []
        should_close = False

        if event == "start":
            start_meta = msg.get("start") or {}
            self.stream_sid = msg.get("streamSid") or start_meta.get("streamSid") or start_meta.get("stream_sid") or self.call_id
            self.call_sid = start_meta.get("callSid") or start_meta.get("call_sid") or self.call_id
            custom_params = start_meta.get("customParameters") or {}
            if custom_params.get("provider"):
                self.provider = str(custom_params["provider"]).lower()

            greeting = self.agent.get("greeting_message")
            if greeting:
                res = RealtimeVoicePipeline.run_turn(
                    conn=self.conn,
                    tenant_id=self.tenant_id,
                    agent=self.agent,
                    user_text="Caller connected. Deliver greeting.",
                    call_id=self.call_id if self.call_exists else None,
                    history=self.history,
                    synthesize_audio=True,
                    lead_context=self.lead_context,
                )
                if res.get("audio_base64"):
                    outbound.extend(self._build_outbound_frames(base64.b64decode(res["audio_base64"])))

        elif event == "media":
            media = msg.get("media") or {}
            b64_chunk = media.get("payload") or ""
            track = (media.get("track") or "inbound").lower()
            if track in ("outbound",):
                return {"outbound": outbound, "should_close": False}

            if b64_chunk:
                raw_chunk = base64.b64decode(b64_chunk)
                pcm_chunk = mulaw_to_pcm16(raw_chunk) if self.provider in ("twilio", "plivo") else raw_chunk
                rms = compute_pcm16_rms(pcm_chunk)
                if rms >= self.speech_rms_threshold:
                    self.speech_active = True
                    self.silent_frames = 0
                    self.audio_buffer.extend(pcm_chunk)
                    if self.ai_speaking:
                        self.ai_speaking = False
                        self.barge_in_count += 1
                        outbound.append({"event": "clear", "streamSid": self.stream_sid or self.call_id})
                elif self.speech_active:
                    self.audio_buffer.extend(pcm_chunk)
                    self.silent_frames += 1
                    if self.silent_frames >= self.silence_frames_to_flush and len(self.audio_buffer) >= self.min_speech_bytes:
                        outbound.extend(self._flush_utterance(user_text_override=msg.get("transcript_hint")))

        elif event == "transcript":
            # Optional text turn injection for live WS testing / text-assisted SIP gateways
            text = (msg.get("text") or "").strip()
            if text:
                outbound.extend(self._flush_utterance(user_text_override=text))

        elif event == "dtmf":
            digit = ((msg.get("dtmf") or {}).get("digit") or msg.get("digit") or "")
            completed_digits = self.dtmf.press(str(digit))
            if completed_digits:
                outbound.extend(self._flush_utterance(user_text_override=f"DTMF input: {completed_digits}"))

        elif event == "mark":
            self.ai_speaking = False

        elif event == "stop":
            if self.audio_buffer and len(self.audio_buffer) >= self.min_speech_bytes:
                outbound.extend(self._flush_utterance())
            should_close = True

        return {
            "outbound": outbound,
            "should_close": should_close,
            "barge_in_count": self.barge_in_count,
        }

    def _flush_utterance(self, user_text_override: Optional[str] = None) -> List[Dict[str, Any]]:
        wav_bytes = pcm16_to_wav(bytes(self.audio_buffer), sample_rate=8000) if self.audio_buffer else None
        self.audio_buffer.clear()
        self.silent_frames = 0
        self.speech_active = False

        turn = RealtimeVoicePipeline.run_turn(
            conn=self.conn,
            tenant_id=self.tenant_id,
            agent=self.agent,
            user_text=user_text_override,
            audio_bytes=wav_bytes if not user_text_override else None,
            call_id=self.call_id if self.call_exists else None,
            history=self.history,
            barge_in=self.barge_in_count > 0,
            synthesize_audio=True,
            lead_context=self.lead_context,
        )
        user_txt = turn.get("user_text", "")
        if user_txt:
            self.history.append({"sender": "user", "text": user_txt})
        if turn.get("reply_text"):
            self.history.append({"sender": "ai", "text": turn["reply_text"]})

        if turn.get("audio_base64"):
            return self._build_outbound_frames(base64.b64decode(turn["audio_base64"]))

        # When TTS credentials are not configured in sandbox, still emit structured text frame
        return [
            {
                "event": "trivaana_turn",
                "call_id": self.call_id,
                "transcript_text": user_txt,
                "reply_text": turn.get("reply_text", ""),
                "tts_mode": turn.get("tts_mode", "browser_fallback"),
            }
        ]

