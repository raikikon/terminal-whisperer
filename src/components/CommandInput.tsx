import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Loader2 } from 'lucide-react';

interface CommandInputProps {
  onExecute: (command: string) => Promise<void>;
  disabled?: boolean;
  isLoading?: boolean;
}

export function CommandInput({ onExecute, disabled, isLoading }: CommandInputProps) {
  const [command, setCommand] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim() || disabled || isLoading) return;
    
    await onExecute(command);
    setCommand('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input
        value={command}
        onChange={(e) => setCommand(e.target.value)}
        placeholder="Enter command..."
        disabled={disabled || isLoading}
        className="flex-1 font-mono bg-background border-border"
      />
      <Button 
        type="submit" 
        disabled={!command.trim() || disabled || isLoading}
        className="gap-2"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        Execute
      </Button>
    </form>
  );
}
