import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { VoiceStudioPanel } from '@/components/dashboard/VoiceStudioPanel';
import { trivaanaApi } from '@/lib/trivaana-api';

class MockAudioElement {
  src: string;
  currentTime = 0;
  duration = 4.2;
  paused = true;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  ontimeupdate: (() => void) | null = null;
  onloadedmetadata: (() => void) | null = null;
  ondurationchange: (() => void) | null = null;

  play = vi.fn(async () => {
    this.paused = false;
  });

  pause = vi.fn(() => {
    this.paused = true;
  });

  constructor(src: string) {
    this.src = src;
    audioInstances.push(this);
  }
}

let audioInstances: MockAudioElement[] = [];

const MOCK_VOICES = [
  {
    id: 'vp_el_EXAVITQu4vr4xnSDxMaL',
    provider: 'elevenlabs',
    provider_voice_id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah - Mature, Reassuring, Confident',
    language: 'en-IN',
    gender: 'female',
    category: 'premade',
    accent: 'american',
    access_status: 'available',
    provider_configured: true,
    supported_models: ['eleven_v4_turbo', 'eleven_flash_v2_5'],
    supported_languages: ['en-IN', 'hi-IN', 'te-IN', 'ta-IN', 'as-IN', 'ur-IN'],
    is_favorite: false,
  },
  {
    id: 'vp_sv_kavitha',
    provider: 'sarvam',
    provider_voice_id: 'kavitha',
    name: 'Kavitha',
    language: 'hi-IN',
    gender: 'female',
    category: 'bulbul_v3',
    accent: 'south-indian',
    model_id: 'bulbul:v3',
    access_status: 'available',
    provider_configured: true,
    supported_models: ['bulbul:v3'],
    supported_languages: ['en-IN', 'hi-IN', 'te-IN', 'ta-IN'],
    is_favorite: false,
  },
  {
    id: 'vp_el_restricted',
    provider: 'elevenlabs',
    provider_voice_id: '7qBNUtXRGP0jPi0H4r8k',
    name: 'Bunty Pro',
    language: 'hi-IN',
    gender: 'male',
    category: 'professional',
    accent: 'indian',
    access_status: 'plan_upgrade_required',
    provider_configured: true,
    supported_models: ['eleven_v4_turbo'],
    supported_languages: ['en-IN', 'hi-IN', 'te-IN'],
    is_favorite: false,
  },
  {
    id: 'vp_sv_unconfigured',
    provider: 'sarvam',
    provider_voice_id: 'shubh',
    name: 'Shubh Unconfigured',
    language: 'hi-IN',
    gender: 'male',
    category: 'bulbul_v3',
    accent: 'pan-indian',
    model_id: 'bulbul:v3',
    access_status: 'available',
    provider_configured: false,
    supported_models: ['bulbul:v3'],
    supported_languages: ['en-IN', 'hi-IN', 'te-IN'],
    is_favorite: false,
  },
];

const MOCK_MODELS = [
  {
    model_id: 'eleven_v4_turbo',
    provider: 'elevenlabs',
    name: 'Eleven v4 Turbo',
    can_do_tts: true,
    availability_status: 'available',
    languages: ['en', 'hi', 'te', 'ta', 'as', 'ur'],
    max_chars_subscribed: 10000,
    streaming_supported: true,
    latency_tier: 'low',
  },
  {
    model_id: 'eleven_flash_v2_5',
    provider: 'elevenlabs',
    name: 'Eleven Flash v2.5',
    can_do_tts: true,
    availability_status: 'available',
    languages: ['en', 'hi', 'ta'],
    max_chars_subscribed: 40000,
    streaming_supported: true,
    latency_tier: 'ultra_low',
  },
  {
    model_id: 'scribe_v1',
    provider: 'elevenlabs',
    name: 'Scribe v1 STT',
    can_do_tts: false,
    availability_status: 'restricted',
    languages: ['en', 'hi', 'te'],
    max_chars_subscribed: 0,
    streaming_supported: false,
  },
  {
    model_id: 'bulbul:v3',
    provider: 'sarvam',
    name: 'Sarvam Bulbul v3',
    can_do_tts: true,
    availability_status: 'available',
    languages: ['en', 'hi', 'te', 'ta'],
    max_chars_subscribed: 2500,
    streaming_supported: true,
    latency_tier: 'low',
  },
];

function setupStandardMocks(voicesOverride = MOCK_VOICES) {
  vi.spyOn(trivaanaApi, 'getVoices').mockResolvedValue({
    voices: voicesOverride as any,
    providers: { elevenlabs: true, sarvam: true },
  });
  vi.spyOn(trivaanaApi, 'getVoiceLanguages').mockResolvedValue({
    count: 4,
    languages: [
      { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', recommended_balanced_model: 'eleven_v4_turbo', recommended_economy_model: 'eleven_v4_turbo', recommended_premium_model: 'eleven_v4' },
      { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', recommended_balanced_model: 'eleven_v4_turbo', recommended_economy_model: 'eleven_flash_v2_5', recommended_premium_model: 'eleven_v4' },
      { code: 'en-IN', name: 'English (India)', native: 'English', recommended_balanced_model: 'eleven_v4_turbo', recommended_economy_model: 'eleven_flash_v2_5', recommended_premium_model: 'eleven_v4' },
      { code: 'as-IN', name: 'Assamese', native: 'অসমীয়া', recommended_balanced_model: 'eleven_v4_turbo' },
    ],
  });
  vi.spyOn(trivaanaApi, 'getVoiceModels').mockResolvedValue({
    models: MOCK_MODELS,
    profiles: {},
  });
  vi.spyOn(trivaanaApi, 'getVoicePersonalities').mockResolvedValue({
    personalities: [{ id: 'professional', label: 'Professional', stability: 0.65, similarity_boost: 0.8, style: 0.05 }],
  });
  vi.spyOn(trivaanaApi, 'getAgents').mockResolvedValue({
    agents: [{ id: 'ag_1', name: 'Aravind Real Estate', language: 'te-IN' } as any],
    count: 1,
  });
  vi.spyOn(trivaanaApi, 'getVoiceUsage').mockResolvedValue({
    total_requests: 5,
    cache_hits: 2,
    cache_hit_rate_pct: 40,
    total_characters: 500,
    billed_characters: 300,
    estimated_cost_inr: 5.4,
    avg_latency_ms: 820,
  });
  vi.spyOn(trivaanaApi, 'verifyElevenLabs').mockResolvedValue({
    connected: true,
    tts_models_count: 9,
    elevenlabs: { connected: true, tts_models_count: 9 },
    sarvam: { connected: true, tts_models_count: 2 },
  });
}

describe('VoiceStudioPanel — Complete Play Button & Real TTS Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    audioInstances = [];
    vi.stubGlobal('Audio', MockAudioElement as any);
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, 'createObjectURL', { value: vi.fn(() => 'blob:mock-audio-url'), writable: true });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-audio-url');
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, 'revokeObjectURL', { value: vi.fn(), writable: true });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to All Providers and renders both ElevenLabs and Sarvam voices with provider badges and STT distinction', async () => {
    setupStandardMocks();
    render(<VoiceStudioPanel />);

    await waitFor(() => {
      expect(screen.getAllByText(/Sarah - Mature, Reassuring, Confident/i).length).toBeGreaterThan(0);
      expect(screen.getByText('Kavitha')).toBeInTheDocument();
    });

    const providerSelect = screen.getByLabelText(/Voice Provider/i) as HTMLSelectElement;
    expect(providerSelect.value).toBe('all');
    expect(screen.getByText(/Speech Model Catalogue/i)).toBeInTheDocument();
    expect(screen.getByText(/STT-Only \/ Non-TTS/i)).toBeInTheDocument();
  });

  it('plays ElevenLabs voice with exact voice_id, provider, model, language, and custom sample text', async () => {
    setupStandardMocks();
    const previewSpy = vi.spyOn(trivaanaApi, 'previewVoice').mockResolvedValue({
      status: 'synthesized',
      configured: true,
      provider: 'elevenlabs',
      voice_id: 'EXAVITQu4vr4xnSDxMaL',
      model_used: 'eleven_v4_turbo',
      content_type: 'audio/mpeg',
      audio_base64: btoa('ID3mockaudio'),
      latency_ms: 210,
      cache_hit: false,
      estimated_cost_paise: 120,
    });

    render(<VoiceStudioPanel />);
    await waitFor(() => screen.getByLabelText('Play Sarah - Mature, Reassuring, Confident'));

    const textarea = screen.getByLabelText(/Test Utterance/i);
    fireEvent.change(textarea, { target: { value: 'Custom Telugu audition line' } });

    const modelSelect = screen.getByLabelText(/TTS Model/i);
    fireEvent.change(modelSelect, { target: { value: 'eleven_v4_turbo' } });

    fireEvent.click(screen.getByLabelText('Play Sarah - Mature, Reassuring, Confident'));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_id: 'EXAVITQu4vr4xnSDxMaL',
          provider: 'elevenlabs',
          language: 'te-IN',
          model_id: 'eleven_v4_turbo',
          text: 'Custom Telugu audition line',
        }),
      );
      expect(audioInstances.length).toBe(1);
      expect(audioInstances[0].play).toHaveBeenCalledTimes(1);
    });
  });

  it('plays Sarvam voice with exact speaker ID and sarvam provider', async () => {
    setupStandardMocks();
    const previewSpy = vi.spyOn(trivaanaApi, 'previewVoice').mockResolvedValue({
      status: 'synthesized',
      configured: true,
      provider: 'sarvam',
      voice_id: 'kavitha',
      model_used: 'bulbul:v3',
      content_type: 'audio/mpeg',
      audio_base64: btoa('ID3sarvamaudio'),
      latency_ms: 190,
      cache_hit: false,
      estimated_cost_paise: 90,
    });

    render(<VoiceStudioPanel />);
    await waitFor(() => screen.getByLabelText('Play Kavitha'));

    fireEvent.click(screen.getByLabelText('Play Kavitha'));

    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          voice_id: 'kavitha',
          provider: 'sarvam',
          language: 'te-IN',
        }),
      );
      expect(audioInstances[0].play).toHaveBeenCalled();
    });
  });

  it('shows loading state, prevents duplicate requests, and supports Pause, Resume, Stop, and switching voices', async () => {
    setupStandardMocks();
    let resolveFirst!: (v: any) => void;
    const firstPromise = new Promise((res) => {
      resolveFirst = res;
    });
    const previewSpy = vi
      .spyOn(trivaanaApi, 'previewVoice')
      .mockReturnValueOnce(firstPromise as any)
      .mockResolvedValueOnce({
        status: 'synthesized',
        configured: true,
        provider: 'sarvam',
        voice_id: 'kavitha',
        model_used: 'bulbul:v3',
        content_type: 'audio/mpeg',
        audio_base64: btoa('ID3second'),
      });

    render(<VoiceStudioPanel />);
    await waitFor(() => screen.getByLabelText('Play Sarah - Mature, Reassuring, Confident'));

    const sarahBtn = screen.getByLabelText('Play Sarah - Mature, Reassuring, Confident');
    fireEvent.click(sarahBtn);

    // Loading state & duplicate click prevention
    expect(screen.getAllByText('Generating...').length).toBeGreaterThan(0);
    fireEvent.click(sarahBtn);
    expect(previewSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirst({
        status: 'synthesized',
        configured: true,
        provider: 'elevenlabs',
        voice_id: 'EXAVITQu4vr4xnSDxMaL',
        model_used: 'eleven_v4_turbo',
        content_type: 'audio/mpeg',
        audio_base64: btoa('ID3first'),
      });
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Stop Sarah - Mature, Reassuring, Confident')).toBeInTheDocument();
    });

    // Pause & Resume
    fireEvent.click(screen.getByLabelText('Pause Sarah - Mature, Reassuring, Confident'));
    expect(audioInstances[0].pause).toHaveBeenCalled();
    expect(screen.getByLabelText('Resume Sarah - Mature, Reassuring, Confident')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Resume Sarah - Mature, Reassuring, Confident'));
    expect(audioInstances[0].play).toHaveBeenCalledTimes(2);

    // Switch to another voice stops previous audio & revokes object URL
    fireEvent.click(screen.getByLabelText('Play Kavitha'));
    await waitFor(() => {
      expect(audioInstances.length).toBe(2);
      expect(URL.revokeObjectURL).toHaveBeenCalled();
    });

    // Stop button resets playback
    fireEvent.click(screen.getByLabelText('Stop Kavitha'));
    expect(audioInstances[1].pause).toHaveBeenCalled();
    expect(screen.queryByLabelText('Stop Kavitha')).not.toBeInTheDocument();
  });

  it('blocks invalid language/model combinations and disables incompatible model options', async () => {
    setupStandardMocks();
    render(<VoiceStudioPanel />);
    await waitFor(() => screen.getByLabelText(/TTS Model/i));

    const modelSelect = screen.getByLabelText(/TTS Model/i) as HTMLSelectElement;
    const flashOption = Array.from(modelSelect.options).find((o) => o.value === 'eleven_flash_v2_5');
    // Under te-IN, eleven_flash_v2_5 must be disabled
    expect(flashOption?.disabled).toBe(true);
    expect(flashOption?.textContent).toContain('Unsupported for te-IN');

    // Switching to hi-IN enables eleven_flash_v2_5
    fireEvent.change(screen.getByLabelText(/Indian Language/i), { target: { value: 'hi-IN' } });
    await waitFor(() => {
      const updatedFlash = Array.from(modelSelect.options).find((o) => o.value === 'eleven_flash_v2_5');
      expect(updatedFlash?.disabled).toBe(false);
    });
  });

  it('handles missing provider credentials, API errors, rate limits, restricted voices, and audio decoding errors', async () => {
    setupStandardMocks();
    render(<VoiceStudioPanel />);
    await waitFor(() => screen.getByLabelText('Play Shubh Unconfigured'));

    // Unconfigured & restricted voices have disabled Play buttons
    expect(screen.getByLabelText('Play Shubh Unconfigured')).toBeDisabled();
    expect(screen.getByLabelText('Play Bunty Pro')).toBeDisabled();

    // Provider API error (401)
    vi.spyOn(trivaanaApi, 'previewVoice').mockRejectedValueOnce(new Error('Invalid ElevenLabs API key'));
    fireEvent.click(screen.getByLabelText('Play Sarah - Mature, Reassuring, Confident'));
    await waitFor(() => {
      expect(screen.getAllByText(/Invalid ElevenLabs API key/i).length).toBeGreaterThan(0);
    });

    // Rate limit error (429)
    vi.spyOn(trivaanaApi, 'previewVoice').mockRejectedValueOnce(new Error('Voice preview rate limit exceeded'));
    fireEvent.click(screen.getByLabelText('Play Sarah - Mature, Reassuring, Confident'));
    await waitFor(() => {
      expect(screen.getAllByText(/rate limit exceeded/i).length).toBeGreaterThan(0);
    });

    // Audio decoding error
    vi.spyOn(trivaanaApi, 'previewVoice').mockResolvedValueOnce({
      status: 'synthesized',
      configured: true,
      provider: 'sarvam',
      voice_id: 'kavitha',
      model_used: 'bulbul:v3',
      content_type: 'audio/mpeg',
      audio_base64: btoa('corrupt-bytes'),
    });
    fireEvent.click(screen.getByLabelText('Play Kavitha'));
    await waitFor(() => expect(audioInstances.length).toBe(1));
    act(() => {
      audioInstances[0].onerror?.();
    });
    await waitFor(() => {
      expect(screen.getAllByText(/failed to decode/i).length).toBeGreaterThan(0);
    });
  });

  it('supports Generate & Play, Compare voice, provider/language filter changes, and unmount cleanup', async () => {
    setupStandardMocks();
    const previewSpy = vi.spyOn(trivaanaApi, 'previewVoice').mockResolvedValue({
      status: 'synthesized',
      configured: true,
      provider: 'sarvam',
      voice_id: 'kavitha',
      model_used: 'bulbul:v3',
      content_type: 'audio/mpeg',
      audio_base64: btoa('ID3audio'),
    });

    const { unmount } = render(<VoiceStudioPanel />);
    await waitFor(() => screen.getByText('Generate & Play'));

    // Generate & Play uses selected voice (Sarah)
    fireEvent.click(screen.getByText('Generate & Play'));
    await waitFor(() => {
      expect(previewSpy).toHaveBeenCalledWith(
        expect.objectContaining({ voice_id: 'EXAVITQu4vr4xnSDxMaL', provider: 'elevenlabs' }),
      );
    });

    // Compare button on Kavitha plays Kavitha (NOT Sarah)
    const compareButtons = screen.getAllByText('Compare');
    fireEvent.click(compareButtons[1]);
    await waitFor(() => screen.getByText('Play Compare'));
    fireEvent.click(screen.getByText('Play Compare'));
    await waitFor(() => {
      expect(previewSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({ voice_id: 'kavitha', provider: 'sarvam' }),
      );
    });

    // Provider filter change resets model & calls getVoices with provider
    const getVoicesSpy = vi.spyOn(trivaanaApi, 'getVoices');
    fireEvent.change(screen.getByLabelText(/Voice Provider/i), { target: { value: 'sarvam' } });
    await waitFor(() => {
      expect(getVoicesSpy).toHaveBeenCalledWith(expect.objectContaining({ provider: 'sarvam' }));
    });

    // Unmount cleans up audio & revokes object URL
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalled();
  });
});
