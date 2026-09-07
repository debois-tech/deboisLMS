import { Loader2, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';

interface MaintenancePageProps {
  onRetry: () => Promise<void>;
}

// Full takeover — no portal chrome — for as long as maintenance mode is on.
export function MaintenancePage({ onRetry }: MaintenancePageProps) {
  const [checking, setChecking] = useState(false);

  const handleRetry = async () => {
    setChecking(true);
    try {
      await onRetry();
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="maintenance-page">
      <span className="maintenance-emoji" aria-hidden="true">🛠️</span>
      <h1 className="maintenance-title">brb, GOAT software engineer fixing stuff</h1>
      <p className="maintenance-body">
        The LMS stepped out to fix a few gremlins in the wiring. Try again in a bit probably not on fire. 🔥
      </p>
      <Button className="action-button-compact" variant="secondary" onClick={handleRetry} disabled={checking}>
        {checking ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        Try again
      </Button>
    </div>
  );
}
