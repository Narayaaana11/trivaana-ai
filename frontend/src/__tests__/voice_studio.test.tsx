import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { VoiceStudioPanel } from '@/components/dashboard/VoiceStudioPanel';
import { trivaanaApi } from '@/lib/trivaana-api';

describe('VoiceStudioPanel (ElevenLabs Multilingual Indian Catalog)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders live ElevenLabs voices, 13-language selector, quality profile, and AI Employee assignment', async () => {
    vi.spyOn(trivaanaApi, 'getVoices').mockResolvedValue({
      voices: [
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
          is_favorite: false,
        },
      ],
      providers: { elevenlabs: true },
    });
    vi.spyOn(trivaanaApi, 'getVoiceLanguages').mockResolvedValue({
      count: 2,
      languages: [
        { code: 'te-IN', name: 'Telugu', native: 'తెలుగు', recommended_balanced_model: 'eleven_v4_turbo' },
        { code: 'hi-IN', name: 'Hindi', native: 'हिन्दी', recommended_balanced_model: 'eleven_v4_turbo' },
      ],
    });
    vi.spyOn(trivaanaApi, 'getVoiceModels').mockResolvedValue({
      models: [
        { model_id: 'eleven_v4_turbo', quality_tier: 'balanced', latency_tier: 'low', languages: ['en', 'hi', 'te'], max_chars_subscribed: 10000 },
      ],
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
    vi.spyOn(trivaanaApi, 'verifyElevenLabs').mockResolvedValue({ connected: true, tts_models_count: 9 });

    render(<VoiceStudioPanel />);

    await waitFor(() => {
      expect(screen.getByText(/Voice Studio & Indian AI Voice Catalog/i)).toBeInTheDocument();
      expect(screen.getAllByText(/Sarah - Mature, Reassuring, Confident/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/ElevenLabs \(9 models\)/i)).toBeInTheDocument();
      expect(screen.getByText(/Save Voice to AI Employee/i)).toBeInTheDocument();
    });
  });
});
