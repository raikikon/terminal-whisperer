import { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, Loader2, RefreshCw, Eye, EyeOff, Copy, Check, Trash2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

interface FreeModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
}

interface LLMPanelProps {
  models: FreeModel[];
  onFetchModels: () => Promise<FreeModel[]>;
  onGetSuggestion: (apiKey: string, modelName: string) => Promise<{
    suggestedCommand: string;
    lastCommand: string;
    lastOutput: string;
  }>;
  onClearHistory: () => Promise<void>;
  onExecuteCommand: (command: string) => void;
  onWaitForExecution: () => Promise<void>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function LLMPanel({
  models,
  onFetchModels,
  onGetSuggestion,
  onClearHistory,
  onExecuteCommand,
  onWaitForExecution,
  isLoading,
  disabled,
}: LLMPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoModeRef = useRef(false);
  const modelsRef = useRef<FreeModel[]>([]);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id);
    }
    modelsRef.current = models;
  }, [models, selectedModel]);

  useEffect(() => {
    autoModeRef.current = isAutoMode;
  }, [isAutoMode]);

  const handleFetchModels = async () => {
    setIsLoadingModels(true);
    try {
      await onFetchModels();
      toast.success('Models loaded successfully');
    } catch (err) {
      toast.error('Failed to load models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleGetSuggestion = async () => {
    if (!apiKey || !selectedModel) {
      toast.error('Please enter API key and select a model');
      return;
    }

    try {
      const result = await onGetSuggestion(apiKey, selectedModel);
      setSuggestion(result.suggestedCommand);
      toast.success('Suggestion received');
    } catch (err) {
      toast.error('Failed to get suggestion');
    }
  };

  const handleCopySuggestion = useCallback(async () => {
    if (!suggestion) return;
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = suggestion;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        toast.success('Copied to clipboard');
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error('Failed to copy to clipboard');
      }
      document.body.removeChild(textArea);
    }
  }, [suggestion]);

  const handleClearHistory = async () => {
    try {
      await onClearHistory();
      setSuggestion(null);
      toast.success('History cleared');
    } catch {
      toast.error('Failed to clear history');
    }
  };

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const tryGetSuggestionWithFallback = useCallback(async (): Promise<string | null> => {
    const currentModels = modelsRef.current;
    if (!apiKey || currentModels.length === 0) {
      toast.error('Please enter API key and load models first');
      return null;
    }

    // Try selected model first
    const modelOrder = [
      selectedModel,
      ...currentModels.filter(m => m.id !== selectedModel).map(m => m.id)
    ].filter(Boolean);

    for (const modelId of modelOrder) {
      if (!autoModeRef.current) return null; // Stop if auto mode disabled
      
      try {
        toast.info(`Trying model: ${currentModels.find(m => m.id === modelId)?.name || modelId}`);
        const result = await onGetSuggestion(apiKey, modelId);
        if (result.suggestedCommand) {
          setSelectedModel(modelId);
          return result.suggestedCommand;
        }
      } catch (err) {
        console.error(`Model ${modelId} failed:`, err);
        continue;
      }
    }

    toast.error('All models failed to provide a suggestion');
    return null;
  }, [apiKey, selectedModel, onGetSuggestion]);

  const runAutoMode = useCallback(async () => {
    if (!autoModeRef.current) return;
    
    setIsAutoRunning(true);
    
    // Step 1: Get command from LLM (try all models until one succeeds)
    toast.info('Fetching command suggestion from LLM...');
    const command = await tryGetSuggestionWithFallback();
    
    if (!autoModeRef.current) {
      setIsAutoRunning(false);
      return;
    }

    if (!command) {
      setIsAutoMode(false);
      setIsAutoRunning(false);
      toast.error('Auto mode stopped: Could not get suggestion from any model');
      return;
    }

    setSuggestion(command);
    
    // Step 2: Wait 2 seconds before executing
    toast.info('Command received. Waiting 2 seconds before execution...');
    await delay(2000);
    
    if (!autoModeRef.current) {
      setIsAutoRunning(false);
      return;
    }
    
    // Step 3: Execute the command
    toast.success(`Executing: ${command}`);
    onExecuteCommand(command);
    
    // Step 4: Wait for command to complete (wait for terminal output to settle)
    toast.info('Waiting for command to complete...');
    await onWaitForExecution();
    
    if (!autoModeRef.current) {
      setIsAutoRunning(false);
      return;
    }
    
    // Step 5: Continue auto mode loop
    setIsAutoRunning(false);
    runAutoMode();
  }, [tryGetSuggestionWithFallback, onExecuteCommand, onWaitForExecution]);

  const handleToggleAutoMode = async () => {
    if (isAutoMode) {
      setIsAutoMode(false);
      autoModeRef.current = false;
      toast.info('Auto mode stopped');
    } else {
      if (!apiKey) {
        toast.error('Please enter API key first');
        return;
      }
      if (models.length === 0) {
        toast.error('Please load models first');
        return;
      }
      setIsAutoMode(true);
      autoModeRef.current = true;
      toast.success('Auto mode started');
      runAutoMode();
    }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          LLM Penetration Testing Assistant
        </CardTitle>
        <CardDescription>
          Get AI-powered command suggestions based on previous execution results
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">OpenRouter API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="pr-10 font-mono text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setShowApiKey(!showApiKey)}
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="model">Model</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFetchModels}
              disabled={isLoadingModels}
              className="h-7 text-xs gap-1"
            >
              {isLoadingModels ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Refresh
            </Button>
          </div>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id="model" className="bg-background">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {models.length === 0 ? (
                <SelectItem value="_empty" disabled>
                  No models loaded - click Refresh
                </SelectItem>
              ) : (
                models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={handleGetSuggestion}
            disabled={!apiKey || !selectedModel || isLoading || disabled || isAutoMode}
            className="flex-1 gap-2"
          >
            {isLoading && !isAutoRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Get Suggestion
          </Button>
          
          <Button
            onClick={handleToggleAutoMode}
            disabled={disabled}
            variant={isAutoMode ? "destructive" : "secondary"}
            className="gap-2"
          >
            {isAutoMode ? (
              <>
                <Square className="h-4 w-4" />
                Stop
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Auto
              </>
            )}
          </Button>
        </div>

        <Button
          onClick={handleClearHistory}
          disabled={isLoading || disabled}
          variant="outline"
          className="w-full gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Clear History
        </Button>

        {suggestion && (
          <div className="mt-4 p-3 rounded-lg bg-muted/50 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Suggested Command
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleCopySuggestion}
                className="h-6 w-6"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </Button>
            </div>
            <code className="block text-sm font-mono text-foreground break-all">
              {suggestion}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
