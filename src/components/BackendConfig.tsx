import { useState, FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Server, Loader2, Check, X } from 'lucide-react';

interface BackendConfigProps {
  currentUrl: string;
  onConnect: (url: string) => void;
  onCheckHealth: () => Promise<boolean>;
  isConnected: boolean;
}

export function BackendConfig({
  currentUrl,
  onConnect,
  onCheckHealth,
  isConnected,
}: BackendConfigProps) {
  const [url, setUrl] = useState(currentUrl);
  const [isChecking, setIsChecking] = useState(false);
  const [healthStatus, setHealthStatus] = useState<boolean | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onConnect(url.trim().replace(/\/$/, ''));
    }
  };

  const handleCheckHealth = async () => {
    setIsChecking(true);
    const healthy = await onCheckHealth();
    setHealthStatus(healthy);
    setIsChecking(false);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Server className="h-5 w-5" />
          Backend Configuration
        </CardTitle>
        <CardDescription>
          Configure the connection to your Node.js backend server
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="backendUrl">Backend URL</Label>
            <div className="flex gap-2">
              <Input
                id="backendUrl"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="http://localhost:3001"
                className="flex-1 font-mono text-sm"
              />
              <Button type="submit" variant="secondary">
                Connect
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCheckHealth}
              disabled={isChecking}
              className="gap-2"
            >
              {isChecking ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : healthStatus === true ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : healthStatus === false ? (
                <X className="h-4 w-4 text-red-500" />
              ) : null}
              Check Health
            </Button>
            {healthStatus !== null && (
              <span className={`text-sm ${healthStatus ? 'text-green-500' : 'text-red-500'}`}>
                {healthStatus ? 'Backend is healthy' : 'Backend unreachable'}
              </span>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
