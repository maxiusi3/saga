'use client';

import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { Card } from '../../ui/card';

interface StoryShareButtonProps {
  storyId: string;
  storyTitle: string;
  className?: string;
}

export function StoryShareButton({ 
  storyId, 
  storyTitle, 
  className = '' 
}: StoryShareButtonProps) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = `${window.location.origin}/dashboard/stories/${storyId}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy link:', error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: storyTitle,
          text: `Listen to this family story: ${storyTitle}`,
          url: shareUrl
        });
      } catch (error) {
        console.error('Error sharing:', error);
      }
    } else {
      setShowShareMenu(true);
    }
  };

  return (
    <div className={`story-share-button relative ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={handleShare}
        className="share-button"
        title="Share story"
      >
        <span className="text-sm">📤</span>
        <span className="ml-1 hidden sm:inline">Share</span>
      </Button>

      {showShareMenu && (
        <div className="absolute top-full right-0 mt-2 z-50">
          <Card className="p-4 w-64 shadow-lg">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Share Story</h4>
              
              <div className="space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="w-full justify-start"
                >
                  {copied ? '✓ Copied!' : '🔗 Copy Link'}
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const subject = encodeURIComponent(`Family Story: ${storyTitle}`);
                    const body = encodeURIComponent(`I wanted to share this family story with you: ${shareUrl}`);
                    window.open(`mailto:?subject=${subject}&body=${body}`);
                  }}
                  className="w-full justify-start"
                >
                  📧 Email
                </Button>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShareMenu(false)}
                className="w-full text-gray-500"
              >
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Backdrop to close menu */}
      {showShareMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowShareMenu(false)}
        />
      )}
    </div>
  );
}