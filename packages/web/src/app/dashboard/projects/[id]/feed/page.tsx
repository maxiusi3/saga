'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Story {
  id: string;
  title: string;
  timestamp: string;
  storytellerName: string;
  audioUrl: string;
  transcriptSnippet: string;
  photoThumbnail?: string;
  interactionCount: number;
  followUpCount: number;
  duration: number;
}

interface ChapterSummary {
  id: string;
  title: string;
  summary: string;
  storyCount: number;
}

interface Project {
  id: string;
  name: string;
  storyteller?: {
    name: string;
    avatar: string;
  };
}

function StoryCard({ story }: { story: Story }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer">
      <Link href={`/dashboard/stories/${story.id}`}>
        <div>
          {/* Story Header */}
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                {story.title}
              </h3>
              <div className="flex items-center text-sm text-gray-600">
                <span>{story.storytellerName}</span>
                <span className="mx-2">•</span>
                <span>{new Date(story.timestamp).toLocaleDateString()}</span>
              </div>
            </div>
            {story.photoThumbnail && (
              <div className="w-16 h-16 bg-gray-200 rounded-lg ml-4 flex-shrink-0">
                <img 
                  src={story.photoThumbnail} 
                  alt="Story photo"
                  className="w-full h-full object-cover rounded-lg"
                />
              </div>
            )}
          </div>

          {/* Audio Player */}
          <div className="mb-4">
            <div className="flex items-center bg-gray-50 rounded-lg p-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setIsPlaying(!isPlaying);
                }}
                className="w-10 h-10 bg-blue-600 hover:bg-blue-700 rounded-full flex items-center justify-center text-white mr-3"
              >
                {isPlaying ? (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                )}
              </button>
              
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: '30%' }}></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>0:45</span>
                  <span>{formatDuration(story.duration)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Transcript Snippet */}
          <div className="mb-4">
            <p className="text-gray-700 text-sm leading-relaxed">
              {story.transcriptSnippet}
            </p>
          </div>

          {/* Interaction Summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <span className="flex items-center">
                💬 {story.interactionCount} Comment{story.interactionCount !== 1 ? 's' : ''}
              </span>
              <span className="flex items-center">
                ❓ {story.followUpCount} Follow-up{story.followUpCount !== 1 ? 's' : ''}
              </span>
            </div>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </div>
        </div>
      </Link>
    </Card>
  );
}

function ChapterSummaryCard({ summary }: { summary: ChapterSummary }) {
  return (
    <Card className="p-6 bg-blue-50 border-blue-200">
      <div className="flex items-start">
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4 flex-shrink-0">
          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            {summary.title}
          </h3>
          <p className="text-blue-800 text-sm mb-3">
            {summary.summary}
          </p>
          <div className="text-xs text-blue-600">
            Based on {summary.storyCount} stories
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function ProjectFeedPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [chapterSummaries, setChapterSummaries] = useState<ChapterSummary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch actual project and stories data from API
    // For now, using mock data
    setTimeout(() => {
      setProject({
        id: params.id as string,
        name: "Dad's Life Story",
        storyteller: {
          name: "John Doe",
          avatar: "/avatars/john.jpg"
        }
      });

      setStories([
        {
          id: '1',
          title: 'Growing Up During the War',
          timestamp: '2024-01-15T10:30:00Z',
          storytellerName: 'John Doe',
          audioUrl: '/audio/story1.mp3',
          transcriptSnippet: 'I remember when I was just seven years old, the air raid sirens would go off and we\'d all rush to the basement. My mother would gather us children...',
          photoThumbnail: '/photos/wartime.jpg',
          interactionCount: 3,
          followUpCount: 1,
          duration: 245
        },
        {
          id: '2',
          title: 'Meeting Your Grandmother',
          timestamp: '2024-01-14T15:45:00Z',
          storytellerName: 'John Doe',
          audioUrl: '/audio/story2.mp3',
          transcriptSnippet: 'It was at the church dance in 1952. She was wearing a blue dress and had the most beautiful smile. I knew right then that I had to ask her to dance...',
          interactionCount: 5,
          followUpCount: 2,
          duration: 180
        }
      ]);

      setChapterSummaries([
        {
          id: '1',
          title: 'Early Life & Family',
          summary: 'Stories about childhood, family traditions, and formative experiences during wartime.',
          storyCount: 5
        }
      ]);

      setLoading(false);
    }, 1000);
  }, [params.id]);

  const filteredStories = stories.filter(story =>
    story.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    story.transcriptSnippet.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleProjectSettings = () => {
    router.push(`/dashboard/projects/${params.id}/settings`);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-gray-200 rounded mb-6"></div>
          <div className="space-y-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!project?.storyteller) {
    // Awaiting Invitation State
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">{project?.name}</h1>
          <Button 
            onClick={handleProjectSettings}
            variant="outline"
            className="flex items-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Project Settings
          </Button>
        </div>

        <div className="text-center py-16">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Invite a Storyteller to begin
          </h2>
          <p className="text-gray-600 mb-8 max-w-md mx-auto">
            This project needs a storyteller to start sharing family memories. 
            Invite a family member to begin recording their stories.
          </p>
          <Link href={`/dashboard/projects/${params.id}/invite`}>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3">
              Invite Storyteller
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">{project.name}</h1>
        <Button 
          onClick={handleProjectSettings}
          variant="outline"
          className="flex items-center"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Project Settings
        </Button>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <input
            type="text"
            placeholder="Search stories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <svg className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Story Feed */}
      <div className="space-y-6">
        {/* Chapter Summaries */}
        {chapterSummaries.map((summary) => (
          <ChapterSummaryCard key={summary.id} summary={summary} />
        ))}

        {/* Stories */}
        {filteredStories.length > 0 ? (
          filteredStories.map((story) => (
            <StoryCard key={story.id} story={story} />
          ))
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No stories found</h3>
            <p className="text-gray-600">
              {searchQuery ? 'Try adjusting your search terms.' : 'Stories will appear here as they are recorded.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}