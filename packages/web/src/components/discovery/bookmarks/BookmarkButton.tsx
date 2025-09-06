'use client';

import React, { useState } from 'react';
import { Button } from '../../ui/button';
import { useBookmarks } from '../../../hooks/use-bookmarks';

interface BookmarkButtonProps {
  storyId: string;
  isBookmarked?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  showText?: boolean;
  className?: string;
}

export function BookmarkButton({
  storyId,
  isBookmarked = false,
  size = 'sm',
  variant = 'ghost',
  showText = false,
  className = ''
}: BookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(isBookmarked);
  const [loading, setLoading] = useState(false);
  const { addBookmark, removeBookmark } = useBookmarks();

  const handleToggleBookmark = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    try {
      setLoading(true);
      
      if (bookmarked) {
        await removeBookmark(storyId);
        setBookmarked(false);
      } else {
        await addBookmark({ storyId });
        setBookmarked(true);
      }
    } catch (error) {
      console.error('Error toggling bookmark:', error);
      // Revert state on error
      setBookmarked(!bookmarked);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleToggleBookmark}
      disabled={loading}
      className={`bookmark-button ${className}`}
      title={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
    >
      <span className={`transition-colors ${bookmarked ? 'text-warning' : 'text-muted-foreground'}`}>
        {bookmarked ? '★' : '☆'}
      </span>
      {showText && (
        <span className="ml-1">
          {loading ? 'Saving...' : bookmarked ? 'Bookmarked' : 'Bookmark'}
        </span>
      )}
    </Button>
  );
}