'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { FurbridgeButton } from '@/components/ui/furbridge-button'
import { FurbridgeCard } from '@/components/ui/furbridge-card'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Mic, Pause, Play, Square, RotateCcw, Send, Volume2, Sparkles, Clock } from 'lucide-react'
import { AIPrompt, getNextPrompt, getPromptById, AIService, AIGeneratedContent } from '@saga/shared'

type RecordingState = 'idle' | 'recording' | 'paused' | 'completed'

function RecordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentPrompt, setCurrentPrompt] = useState<AIPrompt | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiProgress, setAiProgress] = useState(0);
  const [aiContent, setAiContent] = useState<AIGeneratedContent | null>(null);
  const [isPlayingPrompt, setIsPlayingPrompt] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const loadPrompt = async () => {
      try {
        const promptId = searchParams?.get('promptId');
        const customPrompt = searchParams?.get('prompt');
        const promptType = searchParams?.get('type');

        let prompt: AIPrompt | null = null;

        if (customPrompt) {
          prompt = {
            id: 'custom',
            chapter: 'Follow-up',
            chapterNumber: 0,
            category: promptType === 'followup' ? 'Follow-up Question' : 'Custom',
            text: decodeURIComponent(customPrompt),
            estimatedTime: 5
          };
        } else if (promptId) {
          prompt = getPromptById(promptId);
        } else {
          prompt = getNextPrompt();
        }

        if (prompt) {
          setCurrentPrompt(prompt);
        }
      } catch (error) {
        console.error('Failed to load prompt:', error);
      } finally {
        setLoading(false);
      }
    };

    loadPrompt();

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [searchParams]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setRecordingState('recording');

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Unable to access microphone. Please check your permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'recording') {
      mediaRecorderRef.current.pause();
      setRecordingState('paused');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && recordingState === 'paused') {
      mediaRecorderRef.current.resume();
      setRecordingState('recording');
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setRecordingState('completed');
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const resetRecording = () => {
    setRecordingState('idle');
    setRecordingTime(0);
    setAudioBlob(null);
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const submitRecording = async () => {
    if (!audioBlob || !currentPrompt) return;

    setIsSubmitting(true);
    setAiProcessing(true);
    setAiProgress(0);

    try {
      const aiResult = await AIService.processStoryAudio(
        audioBlob,
        currentPrompt.text,
        (step: string, progress: number) => {
          setAiProgress(progress);
        }
      );

      setAiContent(aiResult);

      await new Promise(resolve => setTimeout(resolve, 1000));

      router.push('/storyteller/review?processed=true');
    } catch (error) {
      console.error('Error submitting recording:', error);
      alert('Failed to submit recording. Please try again.');
    } finally {
      setIsSubmitting(false);
      setAiProcessing(false);
    }
  };

  const handlePlayPrompt = () => {
    setIsPlayingPrompt(true);
    setTimeout(() => {
      setIsPlayingPrompt(false);
    }, 3000);
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-furbridge-orange"></div>
      </div>
    );
  }

  if (!currentPrompt) {
    return (
      <div className="text-center py-16">
        <h1 className="text-2xl font-bold text-gray-900">No prompt available</h1>
        <p className="text-gray-600 mt-2">Please check back later.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-furbridge-warm-gray/10 to-furbridge-teal/10 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Link href="/storyteller" className="inline-flex items-center text-gray-600 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Stories
        </Link>

        <FurbridgeCard className="p-8 bg-gradient-to-r from-furbridge-orange/5 to-furbridge-teal/5 border-2 border-furbridge-orange/20">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Badge className="bg-furbridge-orange text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {currentPrompt.chapter}
                </Badge>
                <Badge variant="outline">{currentPrompt.category}</Badge>
              </div>
              <div className="flex items-center space-x-2 text-gray-600">
                <Clock className="h-4 w-4" />
                <span className="text-sm">~{currentPrompt.estimatedTime} min</span>
              </div>
            </div>

            <div className="space-y-4">
              <h1 className="text-2xl font-semibold text-gray-900 leading-relaxed">
                {currentPrompt.text}
              </h1>

              <FurbridgeButton
                variant="outline"
                size="sm"
                onClick={handlePlayPrompt}
                disabled={isPlayingPrompt}
                className="flex items-center space-x-2"
              >
                <Volume2 className="h-4 w-4" />
                <span>{isPlayingPrompt ? 'Playing...' : 'Hear Prompt'}</span>
              </FurbridgeButton>
            </div>
          </div>
        </FurbridgeCard>

        {/* Recording Interface */}
        <FurbridgeCard className="p-8">
          <div className="space-y-6">
            {/* Recording Status */}
            <div className="text-center space-y-2">
              <div className="text-4xl font-mono text-gray-900">
                {formatTime(recordingTime)}
              </div>
              <div className="text-sm text-gray-600">
                {recordingState === 'idle' && 'Ready to record your story'}
                {recordingState === 'recording' && (
                  <span className="flex items-center justify-center space-x-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    <span>Recording...</span>
                  </span>
                )}
                {recordingState === 'paused' && 'Recording paused'}
                {recordingState === 'completed' && 'Recording completed'}
              </div>
            </div>

            {/* Progress Bar (estimated time) */}
            {recordingState !== 'idle' && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Progress</span>
                  <span>{Math.min(100, Math.round((recordingTime / (currentPrompt.estimatedTime * 60)) * 100))}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-furbridge-orange h-2 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (recordingTime / (currentPrompt.estimatedTime * 60)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Recording Controls */}
            <div className="flex justify-center space-x-4">
              {recordingState === 'idle' && (
                <FurbridgeButton
                  variant="orange"
                  size="lg"
                  onClick={startRecording}
                  className="px-8"
                >
                  <Mic className="h-5 w-5 mr-2" />
                  Start Recording
                </FurbridgeButton>
              )}

              {recordingState === 'recording' && (
                <>
                  <FurbridgeButton
                    variant="outline"
                    size="lg"
                    onClick={pauseRecording}
                  >
                    <Pause className="h-5 w-5 mr-2" />
                    Pause
                  </FurbridgeButton>
                  <FurbridgeButton
                    variant="teal"
                    size="lg"
                    onClick={stopRecording}
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop
                  </FurbridgeButton>
                </>
              )}

              {recordingState === 'paused' && (
                <>
                  <FurbridgeButton
                    variant="orange"
                    size="lg"
                    onClick={resumeRecording}
                  >
                    <Play className="h-5 w-5 mr-2" />
                    Resume
                  </FurbridgeButton>
                  <FurbridgeButton
                    variant="teal"
                    size="lg"
                    onClick={stopRecording}
                  >
                    <Square className="h-5 w-5 mr-2" />
                    Stop
                  </FurbridgeButton>
                </>
              )}

              {recordingState === 'completed' && (
                <>
                  <FurbridgeButton
                    variant="outline"
                    size="lg"
                    onClick={resetRecording}
                  >
                    <RotateCcw className="h-5 w-5 mr-2" />
                    Re-record
                  </FurbridgeButton>
                  <FurbridgeButton
                    variant="orange"
                    size="lg"
                    onClick={submitRecording}
                    disabled={isSubmitting || aiProcessing}
                    className="min-w-48"
                  >
                    {aiProcessing ? (
                      <>
                        <Sparkles className="h-5 w-5 mr-2 animate-pulse" />
                        Processing with AI...
                      </>
                    ) : isSubmitting ? (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Submit Story
                      </>
                    )}
                  </FurbridgeButton>
                </>
              )}
            </div>

            {/* Recording Tips */}
            {recordingState === 'idle' && (
              <div className="bg-gray-100/50 rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-medium text-gray-900">Recording Tips:</h3>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Find a quiet space with minimal background noise</li>
                  <li>• Speak clearly and at a comfortable pace</li>
                  <li>• Take your time - there's no rush</li>
                  <li>• You can pause and resume anytime</li>
                </ul>
              </div>
            )}
          </div>
        </FurbridgeCard>

        {/* AI Processing Status */}
        {aiProcessing && (
          <FurbridgeCard className="p-6 bg-gradient-to-r from-furbridge-teal/5 to-furbridge-orange/5 border-2 border-furbridge-teal/20">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-furbridge-teal"></div>
                <h3 className="text-lg font-semibold text-gray-900">
                  AI is processing your story...
                </h3>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Processing Progress</span>
                  <span>{Math.round(aiProgress)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-furbridge-teal h-2 rounded-full transition-all duration-300"
                    style={{ width: `${aiProgress}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-white/50 rounded-lg p-4">
                <p className="text-sm text-gray-600 mb-2">
                  Our AI is working on your story:
                </p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Transcribing your audio</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Generating a meaningful title</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Creating a summary</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Sparkles className="h-3 w-3 text-furbridge-teal" />
                    <span>Preparing follow-up questions</span>
                  </li>
                </ul>
              </div>
            </div>
          </FurbridgeCard>
        )}

        {/* AI Generated Content Preview */}
        {aiContent && (
          <FurbridgeCard className="p-6 bg-gradient-to-r from-furbridge-teal/5 to-furbridge-orange/5 border-2 border-furbridge-teal/20">
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Sparkles className="h-5 w-5 text-furbridge-teal" />
                <h3 className="text-lg font-semibold text-gray-900">AI Generated Content</h3>
                <Badge className="bg-furbridge-teal text-white text-xs">
                  {Math.round((aiContent.confidence || 0) * 100)}% confidence
                </Badge>
              </div>

              {aiContent.title && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Generated Title:
                  </h4>
                  <p className="text-lg font-semibold text-gray-900">{aiContent.title}</p>
                </div>
              )}

              {aiContent.summary && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Story Summary:
                  </h4>
                  <p className="text-gray-700 leading-relaxed">{aiContent.summary}</p>
                </div>
              )}

              {aiContent.transcript && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Transcript Preview:
                  </h4>
                  <p className="text-sm text-gray-600 line-clamp-3">{aiContent.transcript}</p>
                </div>
              )}

              {aiContent.followUpQuestions && aiContent.followUpQuestions.length > 0 && (
                <div className="bg-white/50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center">
                    <Sparkles className="h-3 w-3 mr-1 text-furbridge-orange" />
                    Suggested Follow-up Questions:
                  </h4>
                  <div className="space-y-2">
                    {aiContent.followUpQuestions.slice(0, 3).map((question, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <span className="text-furbridge-teal font-medium text-sm mt-0.5">
                          {index + 1}.
                        </span>
                        <p className="text-sm text-gray-700 flex-1">{question}</p>
                      </div>
                    ))}
                  </div>

                  {aiContent.followUpQuestions.length > 3 && (
                    <p className="text-xs text-gray-500 mt-2">
                      +{aiContent.followUpQuestions.length - 3} more questions available
                    </p>
                  )}
                </div>
              )}

              <div className="flex justify-center pt-4">
                <FurbridgeButton
                  variant="orange"
                  onClick={() => router.push('/storyteller/review?processed=true')}
                  className="px-8"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Continue to Review
                </FurbridgeButton>
              </div>
            </div>
          </FurbridgeCard>
        )}
      </div>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    }>
      <RecordPageContent />
    </Suspense>
  );
}
