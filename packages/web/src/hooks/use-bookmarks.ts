'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

interface CreateBookmarkRequest {
  storyId: string;
  collectionId?: string;
  notes?: string;
}

interface CreateCollectionRequest {
  name: string;
  description?: string;
  isPublic?: boolean;
  color?: string;
}

interface Bookmark {
  id: string;
  userId: string;
  storyId: string;
  collectionId?: string;
  notes?: string;
  createdAt: string;
  story: {
    id: string;
    title: string;
    description?: string;
    duration?: number;
    facilitatorName: string;
    chapterTitle?: string;
  };
}

interface BookmarkCollection {
  id: string;
  userId: string;
  name: string;
  description?: string;
  isPublic: boolean;
  color: string;
  createdAt: string;
  bookmarkCount: number;
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [collections, setCollections] = useState<BookmarkCollection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBookmarks = useCallback(async (collectionId?: string) => {
    try {
      setLoading(true);
      setError(null);

      const queryParams = new URLSearchParams();
      if (collectionId) queryParams.append('collectionId', collectionId);

      const response = await api.get(`/bookmarks?${queryParams.toString()}`);
      
      if (response.success) {
        setBookmarks(response.data.bookmarks);
      } else {
        setError(response.error || 'Failed to load bookmarks');
      }
    } catch (err) {
      console.error('Bookmarks fetch error:', err);
      setError('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCollections = useCallback(async () => {
    try {
      const response = await api.get('/bookmarks/collections');
      
      if (response.success) {
        setCollections(response.data);
      } else {
        console.error('Failed to load collections:', response.error);
      }
    } catch (err) {
      console.error('Collections fetch error:', err);
    }
  }, []);

  const addBookmark = useCallback(async (request: CreateBookmarkRequest): Promise<Bookmark> => {
    try {
      const response = await api.post('/bookmarks', request);
      
      if (response.success) {
        const newBookmark = response.data;
        setBookmarks(prev => [newBookmark, ...prev]);
        return newBookmark;
      } else {
        throw new Error(response.error || 'Failed to add bookmark');
      }
    } catch (err) {
      console.error('Add bookmark error:', err);
      throw err;
    }
  }, []);

  const removeBookmark = useCallback(async (storyId: string): Promise<void> => {
    try {
      const response = await api.delete(`/bookmarks/story/${storyId}`);
      
      if (response.success) {
        setBookmarks(prev => prev.filter(bookmark => bookmark.storyId !== storyId));
      } else {
        throw new Error(response.error || 'Failed to remove bookmark');
      }
    } catch (err) {
      console.error('Remove bookmark error:', err);
      throw err;
    }
  }, []);

  const createCollection = useCallback(async (request: CreateCollectionRequest): Promise<BookmarkCollection> => {
    try {
      const response = await api.post('/bookmarks/collections', request);
      
      if (response.success) {
        const newCollection = response.data;
        setCollections(prev => [newCollection, ...prev]);
        return newCollection;
      } else {
        throw new Error(response.error || 'Failed to create collection');
      }
    } catch (err) {
      console.error('Create collection error:', err);
      throw err;
    }
  }, []);

  const updateCollection = useCallback(async (
    collectionId: string,
    updates: Partial<CreateCollectionRequest>
  ): Promise<BookmarkCollection> => {
    try {
      const response = await api.put(`/bookmarks/collections/${collectionId}`, updates);
      
      if (response.success) {
        const updatedCollection = response.data;
        setCollections(prev => 
          prev.map(collection => 
            collection.id === collectionId ? updatedCollection : collection
          )
        );
        return updatedCollection;
      } else {
        throw new Error(response.error || 'Failed to update collection');
      }
    } catch (err) {
      console.error('Update collection error:', err);
      throw err;
    }
  }, []);

  const deleteCollection = useCallback(async (collectionId: string): Promise<void> => {
    try {
      const response = await api.delete(`/bookmarks/collections/${collectionId}`);
      
      if (response.success) {
        setCollections(prev => prev.filter(collection => collection.id !== collectionId));
        // Refresh bookmarks to update collection assignments
        fetchBookmarks();
      } else {
        throw new Error(response.error || 'Failed to delete collection');
      }
    } catch (err) {
      console.error('Delete collection error:', err);
      throw err;
    }
  }, [fetchBookmarks]);

  const moveBookmarkToCollection = useCallback(async (
    bookmarkId: string,
    collectionId?: string
  ): Promise<void> => {
    try {
      const response = await api.put(`/bookmarks/${bookmarkId}/collection`, {
        collectionId
      });
      
      if (response.success) {
        // Refresh bookmarks to reflect the change
        fetchBookmarks();
      } else {
        throw new Error(response.error || 'Failed to move bookmark');
      }
    } catch (err) {
      console.error('Move bookmark error:', err);
      throw err;
    }
  }, [fetchBookmarks]);

  const isBookmarked = useCallback((storyId: string): boolean => {
    return bookmarks.some(bookmark => bookmark.storyId === storyId);
  }, [bookmarks]);

  const getBookmarkByStoryId = useCallback((storyId: string): Bookmark | undefined => {
    return bookmarks.find(bookmark => bookmark.storyId === storyId);
  }, [bookmarks]);

  useEffect(() => {
    fetchBookmarks();
    fetchCollections();
  }, [fetchBookmarks, fetchCollections]);

  return {
    bookmarks,
    collections,
    loading,
    error,
    fetchBookmarks,
    fetchCollections,
    addBookmark,
    removeBookmark,
    createCollection,
    updateCollection,
    deleteCollection,
    moveBookmarkToCollection,
    isBookmarked,
    getBookmarkByStoryId
  };
}