import { useState, useEffect } from 'react';
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
import { Sparkles, Loader2, RefreshCw, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface FreeModel {
  id: string;
  name: string;
  description?: string;
  context_length?: number;
}

interface LLMPanelProps {
  models: FreeModel[];
  onFetchModels: () => Promise<void>;
  onGetSuggestion: (apiKey: string, modelName: string) => Promise<{
    suggestedCommand: string;
    lastCommand: string;
    lastOutput: string;
  }>;
  isLoading?: boolean;
  disabled?: boolean;
}

export function LLMPanel({
  models,
  onFetchModels,
  onGetSuggestion,
  isLoading,
  disabled,
}: LLMPanelProps) {
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    if (models.length > 0 && !selectedModel) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

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

  const handleCopySuggestion = async () => {
    if (suggestion) {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
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

        <Button
          onClick={handleGetSuggestion}
          disabled={!apiKey || !selectedModel || isLoading || disabled}
          className="w-full gap-2"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Get Next Command Suggestion
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
