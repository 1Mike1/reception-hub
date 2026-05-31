import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { clientLogin, setClientSession, getClientSession } from '@/services/clientAuth';
import { adminLogin, setAdminSession, getAdminSession } from '@/services/adminAuth';

type LoginTab = 'admin' | 'client';

export default function LoginPage() {
  const [tab, setTab] = useState<LoginTab>('admin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  // Redirect if already authenticated (check localStorage for both admin and client)
  useEffect(() => {
    const adminSession = getAdminSession();
    const clientSession = getClientSession();
    if (adminSession) {
      navigate('/admin', { replace: true });
    } else if (clientSession) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // ── Admin login (backend MongoDB/JSON) ────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const adminSession = await adminLogin(email, password);
      setAdminSession(adminSession);
      toast({ title: 'Welcome back!', description: `Hi, ${adminSession.name}!` });
      navigate('/admin', { replace: true });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Login failed', description: (err as Error).message });
      setIsSubmitting(false);
    }
  };

  // ── Client login (backend JSON) ───────────────────────────────────────────
  const handleClientLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const clientSession = await clientLogin(email, password);
      setClientSession(clientSession);
      toast({ title: 'Welcome back!', description: `Hi, ${clientSession.company_name}!` });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast({ variant: 'destructive', title: 'Login failed', description: (err as Error).message });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SB</span>
          </div>
          <CardTitle className="text-xl">Sales Bot USA</CardTitle>
          <CardDescription>Sign in to your dashboard</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Tab selector */}
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => { setTab('admin'); setEmail(''); setPassword(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === 'admin'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Admin
            </button>
            <button
              type="button"
              onClick={() => { setTab('client'); setEmail(''); setPassword(''); }}
              className={`flex-1 py-2 text-sm font-medium transition-colors ${
                tab === 'client'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              Client
            </button>
          </div>

          {/* Admin form */}
          {tab === 'admin' && (
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" className="w-full rounded-lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                ) : 'Sign In as Admin'}
              </Button>
            </form>
          )}

          {/* Client form */}
          {tab === 'client' && (
            <form onSubmit={handleClientLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="client-email">Email</Label>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="client-password">Password</Label>
                <Input
                  id="client-password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting}
                />
              </div>
              <Button type="submit" className="w-full rounded-lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Signing in…</>
                ) : 'Sign In as Client'}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                No account?{' '}
                <Link to="/signup" className="text-primary hover:underline">
                  Create one
                </Link>
              </p>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
