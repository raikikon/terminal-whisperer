import { Circle } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  sessionId: string | null;
}

export function ConnectionStatus({ isConnected, sessionId }: ConnectionStatusProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Circle 
        className={`h-3 w-3 ${isConnected ? 'fill-green-500 text-green-500' : 'fill-red-500 text-red-500'}`} 
      />
      <span className={isConnected ? 'text-green-400' : 'text-red-400'}>
        {isConnected ? 'Connected' : 'Disconnected'}
      </span>
      {sessionId && (
        <span className="text-muted-foreground text-xs">
          Session: {sessionId.slice(0, 8)}...
        </span>
      )}
    </div>
  );
}
