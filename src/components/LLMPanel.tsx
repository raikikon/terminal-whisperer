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
import { Sparkles, Loader2, RefreshCw, Eye, EyeOff, Copy, Check, Trash2, Play, Square, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface FreeModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
}

interface LLMPanelProps {
  models: FreeModel[];
  onFetchModels: (baseUrl: string, apiKey?: string) => Promise<FreeModel[]>;
  onGetSuggestion: (baseUrl: string, apiKey: string, modelName: string) => Promise<{
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

const PROVIDER_PRESETS = [
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { label: 'OpenAI', url: 'https://api.openai.com/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', url: 'https://api.together.xyz/v1' },
  { label: 'Ollama (Local)', url: 'http://localhost:11434/v1' },
  { label: 'LM Studio (Local)', url: 'http://localhost:1234/v1' },
];

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
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isAutoMode, setIsAutoMode] = useState(false);
  const [isAutoRunning, setIsAutoRunning] = useState(false);
  const autoModeRef = useRef(false);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  useEffect(() => {
    autoModeRef.current = isAutoMode;
  }, [isAutoMode]);

  const handleFetchModels = async () => {
    if (!apiBaseUrl) {
      toast.error('Please enter an API Base URL first');
      return;
    }
    setIsLoadingModels(true);
    try {
      await onFetchModels(apiBaseUrl, apiKey || undefined);
      toast.success('Models loaded successfully');
    } catch (err) {
      toast.error('Failed to load models');
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleGetSuggestion = async () => {
    if (!apiBaseUrl || !selectedModel) {
      toast.error('Please enter API Base URL and select a model');
      return;
    }

    try {
      const result = await onGetSuggestion(apiBaseUrl, apiKey, selectedModel);
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
    } catch {
      toast.error('Failed to copy to clipboard');
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

  const runAutoMode = useCallback(async (isFirstRun: boolean = false) => {
    if (!autoModeRef.current) return;

    setIsAutoRunning(true);

    // Wait for previous command to complete (skip on first run)
    if (!isFirstRun) {
      toast.info('Waiting for command to complete...');
      await onWaitForExecution();
      if (!autoModeRef.current) { setIsAutoRunning(false); return; }
    }

    // Get suggestion using the selected model only
    toast.info('Fetching command suggestion from LLM...');
    try {
      const result = await onGetSuggestion(apiBaseUrl, apiKey, selectedModel);
      if (!autoModeRef.current) { setIsAutoRunning(false); return; }

      if (!result.suggestedCommand) {
        setIsAutoMode(false);
        setIsAutoRunning(false);
        toast.error('Auto mode stopped: No suggestion received');
        return;
      }

      setSuggestion(result.suggestedCommand);

      toast.info('Command received. Waiting 2 seconds before execution...');
      await delay(2000);
      if (!autoModeRef.current) { setIsAutoRunning(false); return; }

      toast.success(`Executing: ${result.suggestedCommand}`);
      onExecuteCommand(result.suggestedCommand);

      setIsAutoRunning(false);
      runAutoMode(false);
    } catch (err) {
      setIsAutoMode(false);
      autoModeRef.current = false;
      setIsAutoRunning(false);
      toast.error('Auto mode stopped: Failed to get suggestion');
    }
  }, [apiBaseUrl, apiKey, selectedModel, onGetSuggestion, onExecuteCommand, onWaitForExecution]);

  const handleToggleAutoMode = async () => {
    if (isAutoMode) {
      setIsAutoMode(false);
      autoModeRef.current = false;
      toast.info('Auto mode stopped');
    } else {
      if (!apiBaseUrl) {
        toast.error('Please enter API Base URL first');
        return;
      }
      if (!selectedModel) {
        toast.error('Please select a model first');
        return;
      }
      setIsAutoMode(true);
      autoModeRef.current = true;
      toast.success('Auto mode started');
      runAutoMode(true);
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
          Connect any OpenAI-compatible API for AI-powered command suggestions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* API Base URL */}
        <div className="space-y-2">
          <Label htmlFor="baseUrl">API Base URL</Label>
          <div className="flex gap-2">
            <Input
              id="baseUrl"
              type="text"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://api.deepseek.com/v1"
              className="font-mono text-sm flex-1"
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PROVIDER_PRESETS.map((preset) => (
              <Button
                key={preset.url}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setApiBaseUrl(preset.url)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key (optional for local models)</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
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

        {/* Model Select */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="model">Model</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleFetchModels}
              disabled={isLoadingModels || !apiBaseUrl}
              className="h-7 text-xs gap-1"
            >
              {isLoadingModels ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <RefreshCw className="h-3 w-3" />
              )}
              Fetch Models
            </Button>
          </div>
          <Select value={selectedModel} onValueChange={setSelectedModel}>
            <SelectTrigger id="model" className="bg-background">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {models.length === 0 ? (
                <SelectItem value="_empty" disabled>
                  No models loaded - click Fetch Models
                </SelectItem>
              ) : (
                models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name || model.id}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleGetSuggestion}
            disabled={!apiBaseUrl || !selectedModel || isLoading || disabled || isAutoMode}
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
