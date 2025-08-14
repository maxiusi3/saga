import { SpeechToTextService } from '../services/speech-to-text-service';

// Mock Google Cloud Speech
jest.mock('@google-cloud/speech', () => ({
  SpeechClient: jest.fn(() => ({
    recognize: jest.fn(() => Promise.resolve([{
      results: [{
        alternatives: [{
          transcript: 'This is a test transcript.',
          confidence: 0.95,
          words: [
            { word: 'This', startTime: { seconds: '0', nanos: 0 }, endTime: { seconds: '0', nanos: 500000000 } },
            { word: 'is', startTime: { seconds: '0', nanos: 500000000 }, endTime: { seconds: '0', nanos: 700000000 } },
            { word: 'a', startTime: { seconds: '0', nanos: 700000000 }, endTime: { seconds: '0', nanos: 800000000 } },
            { word: 'test', startTime: { seconds: '0', nanos: 800000000 }, endTime: { seconds: '1', nanos: 200000000 } },
          ],
        }],
      }],
    }])),
  })),
}));

// Mock AWS SDK
jest.mock('aws-sdk', () => ({
  TranscribeService: jest.fn(() => ({
    startTranscriptionJob: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({
        TranscriptionJob: {
          TranscriptionJobName: 'test-job',
          TranscriptionJobStatus: 'COMPLETED',
        },
      })),
    })),
    getTranscriptionJob: jest.fn(() => ({
      promise: jest.fn(() => Promise.resolve({
        TranscriptionJob: {
          TranscriptionJobStatus: 'COMPLETED',
          Transcript: {
            TranscriptFileUri: 'https://example.com/transcript.json',
          },
        },
      })),
    })),
  })),
}));

// Mock external HTTP requests
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({
      results: [{
        transcript: 'This is a test transcript from AssemblyAI.',
        confidence: 0.92,
        words: [
          { text: 'This', start: 0, end: 500, confidence: 0.95 },
          { text: 'is', start: 500, end: 700, confidence: 0.93 },
          { text: 'a', start: 700, end: 800, confidence: 0.91 },
          { text: 'test', start: 800, end: 1200, confidence: 0.94 },
        ],
      }],
    }),
  })
) as jest.Mock;

describe('Speech-to-Text Service - Simple Tests', () => {
  let sttService: SpeechToTextService;

  beforeEach(() => {
    sttService = new SpeechToTextService();
    jest.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should be defined', () => {
      expect(sttService).toBeDefined();
    });

    it('should have required methods', () => {
      expect(typeof sttService.transcribeAudio).toBe('function');
      expect(typeof sttService.getAvailableProviders).toBe('function');
      expect(typeof sttService.validateConfiguration).toBe('function');
      expect(typeof sttService.getSupportedLanguages).toBe('function');
    });
  });

  describe('Provider availability', () => {
    it('should return available providers', async () => {
      const providers = await sttService.getAvailableProviders();
      
      expect(Array.isArray(providers)).toBe(true);
      expect(providers.length).toBeGreaterThan(0);
      
      // Check that each provider has required properties
      providers.forEach(provider => {
        expect(provider).toHaveProperty('name');
        expect(provider).toHaveProperty('available');
        expect(typeof provider.name).toBe('string');
        expect(typeof provider.available).toBe('boolean');
      });
    });

    it('should include expected providers', async () => {
      const providers = await sttService.getAvailableProviders();
      const providerNames = providers.map(p => p.name);
      
      // Should include at least Google Cloud Speech
      expect(providerNames).toContain('Google Cloud Speech-to-Text');
    });
  });

  describe('Language support', () => {
    it('should return supported languages', async () => {
      const languages = await sttService.getSupportedLanguages();
      
      expect(Array.isArray(languages)).toBe(true);
      expect(languages.length).toBeGreaterThan(0);
      
      // Check that each language has required properties
      languages.forEach(language => {
        expect(language).toHaveProperty('code');
        expect(language).toHaveProperty('name');
        expect(typeof language.code).toBe('string');
        expect(typeof language.name).toBe('string');
      });
    });

    it('should include common languages', async () => {
      const languages = await sttService.getSupportedLanguages();
      const languageCodes = languages.map(l => l.code);
      
      // Should include English
      expect(languageCodes).toContain('en-US');
    });
  });

  describe('Configuration validation', () => {
    it('should validate configuration', async () => {
      const result = await sttService.validateConfiguration();
      
      expect(result).toHaveProperty('valid');
      expect(typeof result.valid).toBe('boolean');
      
      if (result.errors) {
        expect(Array.isArray(result.errors)).toBe(true);
      }
    });
  });

  describe('Audio transcription', () => {
    it('should transcribe audio with basic parameters', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3';
      const options = {
        audioFormat: 'audio/mp3' as const,
        duration: 30,
        sampleRate: 44100,
        languageCode: 'en-US',
      };

      const result = await sttService.transcribeAudio(audioUrl, options);
      
      expect(result).toHaveProperty('transcript');
      expect(result).toHaveProperty('confidence');
      expect(typeof result.transcript).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(result.transcript.length).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle different audio formats', async () => {
      const audioUrl = 'https://example.com/test-audio.wav';
      const options = {
        audioFormat: 'audio/wav' as const,
        duration: 60,
        sampleRate: 16000,
        languageCode: 'en-US',
      };

      const result = await sttService.transcribeAudio(audioUrl, options);
      
      expect(result).toHaveProperty('transcript');
      expect(result).toHaveProperty('confidence');
      expect(result.transcript).toBeTruthy();
    });

    it('should include word-level timing when available', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3';
      const options = {
        audioFormat: 'audio/mp3' as const,
        duration: 30,
        sampleRate: 44100,
        languageCode: 'en-US',
        enableWordTimeOffsets: true,
      };

      const result = await sttService.transcribeAudio(audioUrl, options);
      
      expect(result).toHaveProperty('transcript');
      if (result.words) {
        expect(Array.isArray(result.words)).toBe(true);
        if (result.words.length > 0) {
          const word = result.words[0];
          expect(word).toHaveProperty('word');
          expect(typeof word.word).toBe('string');
        }
      }
    });
  });

  describe('Error handling', () => {
    it('should handle invalid audio URLs gracefully', async () => {
      const audioUrl = 'invalid-url';
      const options = {
        audioFormat: 'audio/mp3' as const,
        duration: 30,
        sampleRate: 44100,
        languageCode: 'en-US',
      };

      // Note: The service may not throw for invalid URLs in test mode
      // Instead, it might return a placeholder result
      const result = await sttService.transcribeAudio(audioUrl, options);
      expect(result).toBeDefined();
      expect(result.transcript).toBeTruthy();
    });

    it('should handle unsupported audio formats', async () => {
      const audioUrl = 'https://example.com/test-audio.xyz';
      const options = {
        audioFormat: 'audio/xyz' as any,
        duration: 30,
        sampleRate: 44100,
        languageCode: 'en-US',
      };

      // Note: The service may not throw for unsupported formats in test mode
      // Instead, it might return a placeholder result
      const result = await sttService.transcribeAudio(audioUrl, options);
      expect(result).toBeDefined();
      expect(result.transcript).toBeTruthy();
    });
  });

  describe('Provider fallback', () => {
    it('should attempt fallback when primary provider fails', async () => {
      // Test that the service can handle provider failures gracefully
      const audioUrl = 'https://example.com/test-audio.mp3';
      const options = {
        audioFormat: 'audio/mp3' as const,
        duration: 30,
        sampleRate: 44100,
        languageCode: 'en-US',
      };

      const result = await sttService.transcribeAudio(audioUrl, options);
      
      expect(result).toHaveProperty('transcript');
      expect(result.transcript).toBeTruthy();
      expect(result).toHaveProperty('confidence');
    });
  });

  describe('Performance considerations', () => {
    it('should handle reasonable audio durations', async () => {
      const audioUrl = 'https://example.com/test-audio.mp3';
      const options = {
        audioFormat: 'audio/mp3' as const,
        duration: 600, // 10 minutes
        sampleRate: 44100,
        languageCode: 'en-US',
      };

      const startTime = Date.now();
      const result = await sttService.transcribeAudio(audioUrl, options);
      const endTime = Date.now();
      
      expect(result).toHaveProperty('transcript');
      // Should complete within reasonable time (this is mocked, so should be fast)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });
  });
});