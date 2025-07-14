import { useState, useEffect, useCallback } from 'react';
import NotionService, { NotionPage, NotionDatabase, NotionBlock } from '@/services/notionService';
import { NotionTask } from '@/types';

interface UseNotionAPIProps {
  apiKey?: string;
  enabled?: boolean;
}

interface NotionAPIState {
  isLoading: boolean;
  error: string | null;
  isConnected: boolean;
  pages: NotionPage[];
  databases: NotionDatabase[];
  tasks: NotionTask[];
}

export function useNotionAPI({ apiKey, enabled = true }: UseNotionAPIProps = {}) {
  const [state, setState] = useState<NotionAPIState>({
    isLoading: false,
    error: null,
    isConnected: false,
    pages: [],
    databases: [],
    tasks: [],
  });

  const [notionService, setNotionService] = useState<NotionService | null>(null);

  // Initialize Notion service when API key is provided
  useEffect(() => {
    if (apiKey && enabled) {
      const service = new NotionService(apiKey);
      setNotionService(service);
      setState(prev => ({ ...prev, isConnected: true, error: null }));
    } else {
      setNotionService(null);
      setState(prev => ({ ...prev, isConnected: false, error: null }));
    }
  }, [apiKey, enabled]);

  // Generic error handler
  const handleError = useCallback((error: any) => {
    console.error('Notion API Error:', error);
    const errorMessage = error.message || 'An error occurred while connecting to Notion';
    setState(prev => ({ ...prev, error: errorMessage, isLoading: false }));
  }, []);

  // Test connection
  const testConnection = useCallback(async (): Promise<boolean> => {
    if (!notionService) return false;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await notionService.search('', undefined);
      setState(prev => ({ ...prev, isLoading: false, isConnected: true }));
      return true;
    } catch (error) {
      handleError(error);
      setState(prev => ({ ...prev, isConnected: false }));
      return false;
    }
  }, [notionService, handleError]);

  // Load all pages
  const loadPages = useCallback(async () => {
    if (!notionService) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const pages = await notionService.getAllPages();
      setState(prev => ({ ...prev, pages, isLoading: false }));
    } catch (error) {
      handleError(error);
    }
  }, [notionService, handleError]);

  // Load all databases
  const loadDatabases = useCallback(async () => {
    if (!notionService) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const databases = await notionService.getAllDatabases();
      setState(prev => ({ ...prev, databases, isLoading: false }));
    } catch (error) {
      handleError(error);
    }
  }, [notionService, handleError]);

  // Search for pages and databases
  const search = useCallback(async (query: string): Promise<(NotionPage | NotionDatabase)[]> => {
    if (!notionService) return [];

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const response = await notionService.search(query);
      setState(prev => ({ ...prev, isLoading: false }));
      return response.results;
    } catch (error) {
      handleError(error);
      return [];
    }
  }, [notionService, handleError]);

  // Get page content
  const getPageContent = useCallback(async (pageId: string): Promise<NotionBlock[]> => {
    if (!notionService) return [];

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const blocks = await notionService.getPageContent(pageId);
      setState(prev => ({ ...prev, isLoading: false }));
      return blocks;
    } catch (error) {
      handleError(error);
      return [];
    }
  }, [notionService, handleError]);

  // Get tasks from a database
  const getTasks = useCallback(async (databaseId: string, filters?: {
    status?: string;
    assignee?: string;
    completed?: boolean;
  }): Promise<NotionTask[]> => {
    if (!notionService) return [];

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const tasks = await notionService.getTasks(databaseId, filters);
      setState(prev => ({ ...prev, tasks, isLoading: false }));
      return tasks;
    } catch (error) {
      handleError(error);
      return [];
    }
  }, [notionService, handleError]);

  // Create a new page
  const createPage = useCallback(async (request: {
    parent: { database_id?: string; page_id?: string };
    properties: Record<string, any>;
    children?: any[];
    icon?: { type: 'emoji' | 'external' | 'file'; emoji?: string; external?: { url: string }; file?: { url: string } };
  }): Promise<NotionPage | null> => {
    if (!notionService) return null;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const page = await notionService.createPage(request);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Refresh pages list
      loadPages();
      
      return page;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [notionService, handleError, loadPages]);

  // Create a task
  const createTask = useCallback(async (databaseId: string, task: {
    title: string;
    description?: string;
    status?: string;
    assignee?: string;
    dueDate?: string;
    priority?: string;
  }): Promise<NotionPage | null> => {
    if (!notionService) return null;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const page = await notionService.createTask(databaseId, task);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Refresh tasks list
      getTasks(databaseId);
      
      return page;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [notionService, handleError, getTasks]);

  // Update a page
  const updatePage = useCallback(async (pageId: string, request: {
    properties?: Record<string, any>;
    icon?: { type: 'emoji' | 'external' | 'file'; emoji?: string; external?: { url: string }; file?: { url: string } };
  }): Promise<NotionPage | null> => {
    if (!notionService) return null;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const page = await notionService.updatePage(pageId, request);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Refresh pages list
      loadPages();
      
      return page;
    } catch (error) {
      handleError(error);
      return null;
    }
  }, [notionService, handleError, loadPages]);

  // Delete a page
  const deletePage = useCallback(async (pageId: string): Promise<boolean> => {
    if (!notionService) return false;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await notionService.deletePage(pageId);
      setState(prev => ({ ...prev, isLoading: false }));
      
      // Refresh pages list
      loadPages();
      
      return true;
    } catch (error) {
      handleError(error);
      return false;
    }
  }, [notionService, handleError, loadPages]);

  // Add content to a page
  const addContentToPage = useCallback(async (pageId: string, blocks: any[]): Promise<boolean> => {
    if (!notionService) return false;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await notionService.addBlocksToPage(pageId, blocks);
      setState(prev => ({ ...prev, isLoading: false }));
      return true;
    } catch (error) {
      handleError(error);
      return false;
    }
  }, [notionService, handleError]);

  // Load all data
  const loadAll = useCallback(async () => {
    if (!notionService) return;

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const [pages, databases] = await Promise.all([
        notionService.getAllPages(),
        notionService.getAllDatabases(),
      ]);
      
      setState(prev => ({ 
        ...prev, 
        pages, 
        databases, 
        isLoading: false 
      }));
    } catch (error) {
      handleError(error);
    }
  }, [notionService, handleError]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Helper functions to create common block types
  const createTextBlock = useCallback((text: string) => {
    return notionService?.createTextBlock(text);
  }, [notionService]);

  const createHeadingBlock = useCallback((text: string, level: 1 | 2 | 3 = 1) => {
    return notionService?.createHeadingBlock(text, level);
  }, [notionService]);

  const createBulletListBlock = useCallback((items: string[]) => {
    return notionService?.createBulletListBlock(items);
  }, [notionService]);

  const createCheckboxBlock = useCallback((text: string, checked: boolean = false) => {
    return notionService?.createCheckboxBlock(text, checked);
  }, [notionService]);

  return {
    // State
    ...state,
    
    // Actions
    testConnection,
    loadPages,
    loadDatabases,
    loadAll,
    search,
    getPageContent,
    getTasks,
    createPage,
    createTask,
    updatePage,
    deletePage,
    addContentToPage,
    clearError,
    
    // Block creation helpers
    createTextBlock,
    createHeadingBlock,
    createBulletListBlock,
    createCheckboxBlock,
  };
} 