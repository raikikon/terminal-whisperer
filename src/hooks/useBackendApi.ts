import { useState, useCallback } from 'react';

interface FreeModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
  pricing?: {
    prompt: string;
    completion: string;
  };
}

interface LLMSuggestionResponse {
  success: boolean;
  lastCommand: string;
  lastOutput: string;
  suggestedCommand: string;
  model: string;
  error?: string;
}

interface CommandHistoryResponse {
  lastCommand: string;
  lastOutput: string;
}

export function useBackendApi(backendUrl: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [models, setModels] = useState<FreeModel[]>([]);
  const [error, setError] = useState<string | null>(null);

  const executeCommand = useCallback(async (command: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/api/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to execute command');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  const fetchFreeModels = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/api/models/free`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch models');
      setModels(data.models || []);
      return data.models;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  const getLLMSuggestion = useCallback(async (
    apiKey: string,
    modelName: string
  ): Promise<LLMSuggestionResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/api/llm/suggest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, modelName }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to get suggestion');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  const getLastHistory = useCallback(async (): Promise<CommandHistoryResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/api/history/last`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch history');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  const checkHealth = useCallback(async () => {
    try {
      const response = await fetch(`${backendUrl}/api/health`);
      const data = await response.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }, [backendUrl]);

  const clearHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${backendUrl}/api/history/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to clear history');
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [backendUrl]);

  return {
    isLoading,
    error,
    models,
    executeCommand,
    fetchFreeModels,
    getLLMSuggestion,
    getLastHistory,
    checkHealth,
    clearHistory,
  };
}
