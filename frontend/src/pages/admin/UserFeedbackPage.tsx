import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare } from 'lucide-react';

export default function UserFeedbackPage() {
  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight mb-2">User Feedback</h1>
        <p className="text-muted-foreground">
          Feedback functionality is currently unavailable
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-muted-foreground" />
            <CardTitle>No Feedback Available</CardTitle>
          </div>
          <CardDescription>
            Feedback feature is not configured. Please configure a feedback storage backend.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            To enable feedback collection, integrate a database or feedback service.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
