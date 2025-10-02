'use client'

import { useState } from "react"
import { EnhancedButton } from "@/components/ui/enhanced-button"
import { EnhancedCard, EnhancedCardContent, EnhancedCardHeader, EnhancedCardTitle } from "@/components/ui/enhanced-card"
import { ModernAudioPlayer } from "@/components/ui/modern-audio-player"
import { Share, Export, Edit, Heart, MessageCircle, User, Calendar, Tag, ChevronLeft, MoreHorizontal, Send } from "lucide-react"
import Image from "next/image"

export default function StoryDetailModernPage() {
  const [newComment, setNewComment] = useState("")
  const [newQuestion, setNewQuestion] = useState("")

  // Mock data based on prototype
  const story = {
    id: '1',
    title: "Rosa's Childhood Home",
    author: {
      name: "Grandmother Rosa",
      avatar: "/api/placeholder/40/40",
      role: "Storyteller"
    },
    createdAt: "Dec 2023 - 12:34",
    duration: "12:34",
    chapter: "Childhood",
    audioUrl: "/test.wav",
    photos: [
      "/api/placeholder/600/400",
      "/api/placeholder/300/200",
      "/api/placeholder/300/200",
      "/api/placeholder/300/200"
    ],
    transcript: `Rosa describes the small adobe house where she grew up with her seven siblings, the courtyard filled with her mother's flowers, and the sounds of neighborhood children playing in the dusty streets of her Mexican hometown.

We had a small courtyard in the center, and my mother, she had the most amazing garden there. Bougainvillea climbing up the walls in bright pink and purple, and she grew everything - tomatoes, chiles, cilantro - you know, a real Mexican garden. The smell was heaven, especially in the morning when the dew was still on the plants.

My father built a small kitchen outside, and a ramada - you know, a roof made of branches and palm - where my mother would make tortillas every morning and evening, and we children would help her. The sound of her hands clapping the masa, that was our alarm clock. We'd wake up to that rhythm and the smell of wood smoke from the comal.

I can still see it all so clearly - the way the light came through the ramada in the morning, the chickens running around the courtyard, my brothers and sisters all crowded around that little kitchen, waiting for the first tortillas to come off the comal. Those were simple times, but they were full of love and family, and that house, it held all of us together like the walls of a fortress, keeping us safe and warm.

That house, it held all of us - our parents, our laughter, our tears, when we left for America, I looked back one last time and promised myself I would never forget. And I haven't. I can still see every flower in my mother's garden.`
  }

  const comments = [
    {
      id: '1',
      author: { name: "Maria", avatar: "/api/placeholder/32/32" },
      content: "This brings back so many memories of my own grandmother's house. Thank you for sharing this, Rosa.",
      createdAt: "3 days ago",
      replies: []
    },
    {
      id: '2', 
      author: { name: "Carlos", avatar: "/api/placeholder/32/32" },
      content: "I didn't know how much that house meant to you until now. Do you have any photos of the courtyard with mom's flowers?",
      createdAt: "1 day ago",
      replies: [
        {
          id: '2-1',
          author: { name: "Rosa Martinez", avatar: "/api/placeholder/32/32" },
          content: "I think I do have some old photos. Let me look through my albums and I'll share them with everyone.",
          createdAt: "1 day ago"
        }
      ]
    },
    {
      id: '3',
      author: { name: "Elena", avatar: "/api/placeholder/32/32" },
      content: "The part about the morning tortillas brought tears to my eyes. I can almost hear the sound and smell the wood smoke.",
      createdAt: "6 hours ago",
      replies: []
    }
  ]

  const followUpQuestions = [
    {
      id: '1',
      question: "What happened to your mother's garden when you left for America?",
      author: "Tom Chen",
      createdAt: "2 days ago"
    },
    {
      id: '2',
      question: "Do you remember any specific games you and your siblings played in the courtyard?",
      author: "Sarah Kim", 
      createdAt: "1 day ago"
    }
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <EnhancedButton variant="ghost" size="icon">
                <ChevronLeft className="h-5 w-5" />
              </EnhancedButton>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-medium">S</span>
                </div>
                <div>
                  <h1 className="font-semibold text-foreground">Saga</h1>
                  <p className="text-xs text-muted-foreground">Family Biography & Journaling</p>
                </div>
              </div>
              <div className="text-muted-foreground">•</div>
              <div>
                <p className="text-sm font-medium text-foreground">Rosa's Childhood Home</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <EnhancedButton variant="outline" size="sm" leftIcon={<Share className="h-4 w-4" />}>
                Share
              </EnhancedButton>
              <EnhancedButton variant="outline" size="sm" leftIcon={<Export className="h-4 w-4" />}>
                Export
              </EnhancedButton>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Story Header */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {story.author.avatar ? (
                      <Image
                        src={story.author.avatar}
                        alt={story.author.name}
                        width={48}
                        height={48}
                        className="rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                    )}
                    <div>
                      <h1 className="text-2xl font-bold text-foreground">{story.title}</h1>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                        <span>by {story.author.name}</span>
                        <span>•</span>
                        <span>{story.createdAt}</span>
                        <span className="px-2 py-1 bg-primary/10 text-primary rounded-full text-xs font-medium">
                          {story.chapter}
                        </span>
                      </div>
                    </div>
                  </div>
                  <EnhancedButton variant="ghost" size="icon">
                    <MoreHorizontal className="h-5 w-5" />
                  </EnhancedButton>
                </div>
              </EnhancedCardHeader>
            </EnhancedCard>

            {/* Story Photos */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <div className="flex items-center justify-between">
                  <EnhancedCardTitle>Story Photos</EnhancedCardTitle>
                  <EnhancedButton variant="outline" size="sm" leftIcon={<Edit className="h-4 w-4" />}>
                    Add Photo
                  </EnhancedButton>
                </div>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {story.photos.map((photo, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden group cursor-pointer">
                      <Image
                        src={photo}
                        alt={`Story photo ${index + 1}`}
                        fill
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  ))}
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Audio Recording */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Audio Recording</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <ModernAudioPlayer
                  src={story.audioUrl}
                  title={story.title}
                  subtitle={`by ${story.author.name} • ${story.duration}`}
                  showDownload
                  onDownload={() => console.log('Download audio')}
                />
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Transcript */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <div className="flex items-center justify-between">
                  <EnhancedCardTitle>Transcript</EnhancedCardTitle>
                  <div className="flex items-center gap-2">
                    <EnhancedButton variant="outline" size="sm" leftIcon={<Edit className="h-4 w-4" />}>
                      Edit
                    </EnhancedButton>
                    <EnhancedButton variant="outline" size="sm" leftIcon={<Export className="h-4 w-4" />}>
                      Export
                    </EnhancedButton>
                  </div>
                </div>
              </EnhancedCardHeader>
              <EnhancedCardContent>
                <div className="prose prose-sm max-w-none">
                  {story.transcript.split('\n\n').map((paragraph, index) => (
                    <p key={index} className="text-foreground leading-relaxed mb-4">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Share Story */}
            <EnhancedCard className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
              <EnhancedCardContent className="text-center py-8">
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  请分享一段您印象深刻的家庭回忆
                </h3>
                <p className="text-muted-foreground mb-6">
                  你还有一个可以分享的，一个家庭故事，或者是你想要记录的一些家庭回忆，让我们知道你的想法。
                </p>
                <EnhancedButton variant="default" size="lg">
                  我想要回忆
                </EnhancedButton>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Family Comments */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <div className="flex items-center justify-between">
                  <EnhancedCardTitle className="flex items-center gap-2">
                    Family Comments
                    <span className="px-2 py-1 bg-success/10 text-success rounded-full text-xs font-medium">
                      Continue
                    </span>
                  </EnhancedCardTitle>
                </div>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-4">
                {comments.map((comment) => (
                  <div key={comment.id} className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Image
                        src={comment.author.avatar}
                        alt={comment.author.name}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {comment.author.name}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {comment.createdAt}
                          </span>
                        </div>
                        <p className="text-sm text-foreground leading-relaxed">
                          {comment.content}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <EnhancedButton variant="ghost" size="sm" className="h-6 px-2 text-xs">
                            Reply
                          </EnhancedButton>
                        </div>
                      </div>
                    </div>
                    
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="ml-8 flex items-start gap-3">
                        <Image
                          src={reply.author.avatar}
                          alt={reply.author.name}
                          width={24}
                          height={24}
                          className="rounded-full"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium text-foreground">
                              {reply.author.name}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {reply.createdAt}
                            </span>
                          </div>
                          <p className="text-xs text-foreground leading-relaxed">
                            {reply.content}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
                
                {/* Add Comment */}
                <div className="border-t border-border pt-4">
                  <div className="space-y-3">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="Share your thoughts about this story..."
                      className="w-full p-3 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={3}
                    />
                    <EnhancedButton 
                      size="sm" 
                      className="w-full"
                      rightIcon={<Send className="h-3 w-3" />}
                    >
                      Post Comment
                    </EnhancedButton>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Follow-up Questions */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-warning" />
                  Follow-up Questions
                </EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-4">
                {followUpQuestions.map((question) => (
                  <div key={question.id} className="p-3 bg-warning/5 border border-warning/20 rounded-lg">
                    <p className="text-sm text-foreground mb-2">
                      {question.question}
                    </p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>by {question.author}</span>
                      <span>{question.createdAt}</span>
                    </div>
                  </div>
                ))}
                
                {/* Ask Question */}
                <div className="border-t border-border pt-4">
                  <div className="space-y-3">
                    <textarea
                      value={newQuestion}
                      onChange={(e) => setNewQuestion(e.target.value)}
                      placeholder="Ask a follow-up question about this story..."
                      className="w-full p-3 text-sm border border-input rounded-lg bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={2}
                    />
                    <EnhancedButton 
                      variant="warning"
                      size="sm" 
                      className="w-full"
                      rightIcon={<MessageCircle className="h-3 w-3" />}
                    >
                      Ask Question
                    </EnhancedButton>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Family Engagement */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Family Engagement</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">New comments</span>
                  <span className="font-medium">3</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Story reactions</span>
                  <span className="font-medium">12</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Story shares</span>
                  <span className="font-medium">5</span>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>

            {/* Related Stories */}
            <EnhancedCard>
              <EnhancedCardHeader>
                <EnhancedCardTitle>Related Stories</EnhancedCardTitle>
              </EnhancedCardHeader>
              <EnhancedCardContent className="space-y-3">
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-medium text-primary">2</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      The Journey North
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by Grandmother Rosa
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent cursor-pointer">
                  <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                    <span className="text-xs font-medium text-secondary">3</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground line-clamp-1">
                      Sunday Family Gatherings
                    </p>
                    <p className="text-xs text-muted-foreground">
                      by Uncle Miguel
                    </p>
                  </div>
                </div>
              </EnhancedCardContent>
            </EnhancedCard>
          </div>
        </div>
      </div>
    </div>
  )
}