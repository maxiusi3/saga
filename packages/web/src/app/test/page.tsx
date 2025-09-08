'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, Square, Play, Pause } from 'lucide-react'
import { aiService } from '@/lib/ai-service'
import { storyService } from '@/lib/stories'

export default function TestPage() {
  const [isRecording, setIsRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string>('')
  const [aiResult, setAiResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder

      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data)
        }
      }

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' })
        setAudioBlob(blob)
        setAudioUrl(URL.createObjectURL(blob))
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
      setMessage('录音中...')
    } catch (error) {
      console.error('录音启动失败:', error)
      setMessage('录音启动失败')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setMessage('录音完成')
    }
  }

  const processAudio = async () => {
    if (!audioBlob) {
      setMessage('没有录音文件')
      return
    }

    setLoading(true)
    setMessage('处理音频中...')

    try {
      // 模拟转录
      const mockTranscript = "这是一个测试转录。我正在测试 Saga 应用的录音和 AI 处理功能。这个故事是关于我童年的美好回忆。"
      setTranscript(mockTranscript)

      // 测试 AI 处理
      const result = await aiService.generateAIContent(mockTranscript)
      setAiResult(result)
      setMessage('AI 处理完成')

      // 测试故事保存
      const testUserId = 'test-user-id'
      const testProjectId = 'test-project-id'

      const storyData = {
        project_id: testProjectId,
        storyteller_id: testUserId,
        title: result.title,
        content: mockTranscript,
        transcript: mockTranscript,
        audio_url: null, // 跳过音频上传
        audio_duration: 30,
        ai_generated_title: result.title,
        ai_summary: result.summary,
        ai_follow_up_questions: result.followUpQuestions,
        ai_confidence_score: result.confidenceScore
      }

      const savedStory = await storyService.createStory(storyData)
      if (savedStory) {
        setMessage(`故事保存成功！ID: ${savedStory.id}`)
      } else {
        setMessage('故事保存失败：数据库连接问题')
      }

    } catch (error) {
      console.error('处理失败:', error)
      setMessage(`处理失败: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Saga 功能测试页面</h1>

        {/* 录音控制 */}
        <div className="bg-card p-6 rounded-lg mb-6">
          <h2 className="text-xl font-semibold mb-4">录音测试</h2>
          <div className="flex gap-4 mb-4">
            {!isRecording ? (
              <Button onClick={startRecording} className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                开始录音
              </Button>
            ) : (
              <Button onClick={stopRecording} variant="destructive" className="flex items-center gap-2">
                <Square className="w-4 h-4" />
                停止录音
              </Button>
            )}

            {audioUrl && (
              <Button onClick={() => audioRef.current?.play()} variant="outline" className="flex items-center gap-2">
                <Play className="w-4 h-4" />
                播放录音
              </Button>
            )}

            {audioBlob && (
              <Button onClick={processAudio} disabled={loading} className="flex items-center gap-2">
                {loading ? '处理中...' : '处理音频'}
              </Button>
            )}
          </div>

          {audioUrl && (
            <audio ref={audioRef} src={audioUrl} controls className="w-full mb-4" />
          )}

          {message && (
            <div className="p-3 bg-muted rounded text-sm">
              {message}
            </div>
          )}
        </div>

        {/* 转录结果 */}
        {transcript && (
          <div className="bg-card p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">转录结果</h2>
            <p className="text-muted-foreground">{transcript}</p>
          </div>
        )}

        {/* AI 处理结果 */}
        {aiResult && (
          <div className="bg-card p-6 rounded-lg mb-6">
            <h2 className="text-xl font-semibold mb-4">AI 处理结果</h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-medium">生成标题:</h3>
                <p className="text-muted-foreground">{aiResult.title}</p>
              </div>
              <div>
                <h3 className="font-medium">故事摘要:</h3>
                <p className="text-muted-foreground">{aiResult.summary}</p>
              </div>
              <div>
                <h3 className="font-medium">后续问题:</h3>
                <ul className="list-disc list-inside text-muted-foreground">
                  {aiResult.followUpQuestions?.map((q: string, i: number) => (
                    <li key={i}>{q}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-medium">置信度:</h3>
                <p className="text-muted-foreground">{aiResult.confidenceScore}%</p>
              </div>
            </div>
          </div>
        )}

        {/* 测试信息 */}
        <div className="bg-muted p-4 rounded-lg text-sm">
          <h3 className="font-medium mb-2">测试说明:</h3>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li>这个页面绕过了认证检查，直接测试核心功能</li>
            <li>录音功能使用浏览器 MediaRecorder API</li>
            <li>AI 处理使用真实的 OpenRouter API</li>
            <li>故事保存测试数据库连接和数据结构</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
