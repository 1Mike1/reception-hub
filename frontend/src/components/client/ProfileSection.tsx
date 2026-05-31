import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, Mail, Package } from 'lucide-react';
import { Client } from '@/types';

interface ProfileSectionProps {
  client: Client | undefined;
}

export function ProfileSection({ client }: ProfileSectionProps) {
  if (!client) return null;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case 'pro':
        return 'default';
      case 'growth':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <User className="w-4 h-4 text-primary" />
          Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={client.avatar_url} alt={client.company_name} />
            <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
              {getInitials(client.company_name)}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1">
            <p className="font-semibold text-lg">{client.company_name}</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" />
              {client.business_email}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <Package className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Subscription:</span>
          <Badge variant={getPlanColor(client.subscription_plan)} className="capitalize">
            {client.subscription_plan}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
