import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';
import { clientRegister, setClientSession } from '@/services/clientAuth';

export default function SignupPage() {
  const [form, setForm] = useState({
    company_name: '',
    email: '',
    agent_id: '',
    service_area: '',
    password: '',
    confirm_password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.agent_id.trim()) {
      toast({ variant: 'destructive', title: 'Agent ID is required', description: 'Please enter your ElevenLabs Agent ID.' });
      return;
    }
    if (form.password !== form.confirm_password) {
      toast({ variant: 'destructive', title: 'Passwords do not match' });
      return;
    }
    if (form.password.length < 6) {
      toast({ variant: 'destructive', title: 'Password too short', description: 'Password must be at least 6 characters.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const session = await clientRegister({
        email: form.email,
        password: form.password,
        company_name: form.company_name,
        agent_id: form.agent_id,
        service_area: form.service_area,
      });
      setClientSession(session);
      toast({ title: 'Account created!', description: 'Welcome to 2nd Wave AI.' });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: (err as Error).message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-10 h-10 rounded bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">2W</span>
          </div>
          <CardTitle className="text-xl">Create Client Account</CardTitle>
          <CardDescription>
            Register to manage your AI receptionist dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                name="company_name"
                placeholder="Apex Pest Control"
                value={form.company_name}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={handleChange}
                required
                autoComplete="email"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent_id">
                Agent ID <span className="text-destructive">*</span>
              </Label>
              <Input
                id="agent_id"
                name="agent_id"
                placeholder="e.g. agent_abc123xyz"
                value={form.agent_id}
                onChange={handleChange}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Your ElevenLabs Agent ID — provided by your administrator.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="service_area">Service Area <span className="text-muted-foreground text-xs">(optional)</span></Label>
              <Input
                id="service_area"
                name="service_area"
                placeholder="Austin, TX"
                value={form.service_area}
                onChange={handleChange}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm_password">Confirm Password</Label>
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                placeholder="Re-enter password"
                value={form.confirm_password}
                onChange={handleChange}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
              />
            </div>

            <Button type="submit" className="w-full rounded-lg" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
