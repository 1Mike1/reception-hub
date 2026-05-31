import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FileCheck } from 'lucide-react';

interface PendingProfileUpdatesProps {
  clientId?: string;
}

export function PendingProfileUpdates({ clientId }: PendingProfileUpdatesProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileCheck className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Pending Profile Updates</CardTitle>
        </div>
        <CardDescription>
          Profile update notifications are not available
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          No pending profile updates.
        </p>
      </CardContent>
    </Card>
  );
}
