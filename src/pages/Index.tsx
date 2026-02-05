import { useState, useCallback } from 'react';
import { Terminal, writeToTerminal } from '@/components/Terminal';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { CommandInput } from '@/components/CommandInput';
import { LLMPanel } from '@/components/LLMPanel';
import { BackendConfig } from '@/components/BackendConfig';
import { useTerminalSocket } from '@/hooks/useTerminalSocket';
import { useBackendApi } from '@/hooks/useBackendApi';
import { toast } from 'sonner';
import { TerminalSquare, Shield } from 'lucide-react';

const DEFAULT_BACKEND_URL = 'http://localhost:3001';

const Index = () => {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);

  const handleOutput = useCallback((data: string) => {
    writeToTerminal(data);
  }, []);

  const handleConnected = useCallback((sessionId: string) => {
    toast.success(`Connected to terminal session: ${sessionId.slice(0, 8)}...`);
    writeToTerminal('\r\n\x1b[32m✓ Connected to backend terminal session\x1b[0m\r\n\r\n');
  }, []);

  const handleDisconnected = useCallback(() => {
    toast.error('Disconnected from terminal');
    writeToTerminal('\r\n\x1b[31m✗ Disconnected from backend\x1b[0m\r\n');
  }, []);

  const handleTerminalClosed = useCallback((exitCode: number) => {
    toast.warning(`Terminal closed with exit code: ${exitCode}`);
    writeToTerminal(`\r\n\x1b[33m⚠ Terminal process exited (code: ${exitCode})\x1b[0m\r\n`);
  }, []);

  const { isConnected, sessionId, sendInput, resize } = useTerminalSocket({
    backendUrl,
    onOutput: handleOutput,
    onConnected: handleConnected,
    onDisconnected: handleDisconnected,
    onTerminalClosed: handleTerminalClosed,
  });

  const {
    isLoading,
    models,
    executeCommand,
    fetchFreeModels,
    getLLMSuggestion,
    checkHealth,
  } = useBackendApi(backendUrl);

  const handleExecuteCommand = async (command: string) => {
    try {
      await executeCommand(command);
      toast.success('Command sent');
    } catch (err) {
      toast.error('Failed to execute command');
    }
  };

  const handleGetSuggestion = async (apiKey: string, modelName: string) => {
    const result = await getLLMSuggestion(apiKey, modelName);
    return result;
  };

  const handleConnect = (url: string) => {
    setBackendUrl(url);
    toast.info('Backend URL updated - reconnecting...');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <TerminalSquare className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Pentest Terminal</h1>
              <p className="text-xs text-muted-foreground">AI-Powered Security Research Tool</p>
            </div>
          </div>
          <ConnectionStatus isConnected={isConnected} sessionId={sessionId} />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Terminal Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-card px-4 py-2 border-b border-border flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="text-sm text-muted-foreground ml-2">
                  Terminal Session
                </span>
              </div>
              <div className="h-[500px]">
                <Terminal onInput={sendInput} onResize={resize} />
              </div>
            </div>

            <CommandInput
              onExecute={handleExecuteCommand}
              disabled={!isConnected}
              isLoading={isLoading}
            />
          </div>

          {/* Side Panel */}
          <div className="space-y-4">
            <BackendConfig
              currentUrl={backendUrl}
              onConnect={handleConnect}
              onCheckHealth={checkHealth}
              isConnected={isConnected}
            />

            <LLMPanel
              models={models}
              onFetchModels={fetchFreeModels}
              onGetSuggestion={handleGetSuggestion}
              isLoading={isLoading}
              disabled={!isConnected}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
