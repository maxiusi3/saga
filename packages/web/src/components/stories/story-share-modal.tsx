'use client';

import React, { useState } from 'react';
import { Story } from '@saga/shared';

interface StoryShareModalProps {
  story: Story;
  isOpen: boolean;
  onClose: () => void;
  projectMembers: Array<{ id: string; name: string; email?: string }>;
}

export const StoryShareModal: React.FC<StoryShareModalProps> = ({
  story,
  isOpen,
  onClose,
  projectMembers
}) => {
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSharing, setIsSharing] = useState(false);

  if (!isOpen) return null;

  const handleShare = async () => {
    setIsSharing(true);
    try {
      const response = await fetch(`/api/stories/${story.id}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberIds: selectedMembers,
          message: message.trim() || undefined,
        }),
      });

      if (response.ok) {
        onClose();
        setSelectedMembers([]);
        setMessage('');
      }
    } catch (error) {
      console.error('Failed to share story:', error);
    } finally {
      setIsSharing(false);
    }
  };

  const toggleMember = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <div className="fixed inset-0 bg-background/80 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Share Story</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <h4 className="font-medium text-foreground mb-2">
            "{story.title || 'Untitled Story'}"
          </h4>
          <p className="text-sm text-muted-foreground">
            Share this story with other project members
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Select Members
          </label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {projectMembers.map(member => (
              <label key={member.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={selectedMembers.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                  className="mr-2"
                />
                <span className="text-sm">{member.name}</span>
                {member.email && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({member.email})
                  </span>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-foreground mb-2">
            Message (Optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a personal message..."
            className="w-full p-2 border border-input rounded-md text-sm bg-background"
            rows={3}
          />
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground bg-muted rounded-md hover:bg-muted/90"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={selectedMembers.length === 0 || isSharing}
            className="px-4 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSharing ? 'Sharing...' : 'Share Story'}
          </button>
        </div>
      </div>
    </div>
  );
};