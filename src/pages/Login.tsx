import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserRole } from '@/types';
import { Package, Users, Shield } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('dock');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim() && password.trim()) {
      await login(email, password, role);
      navigate('/');
    }
  };

  const handleDemoLogin = async (demoRole: UserRole) => {
    const demoCredentials = {
      dock: { email: 'dock@warehouse.com', name: 'Dock Employee' },
      office: { email: 'office@warehouse.com', name: 'Office Staff' },
      admin: { email: 'admin@warehouse.com', name: 'Administrator' },
    };

    const creds = demoCredentials[demoRole];
    await login(creds.email, 'demo123', demoRole);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src="https://mgx-backend-cdn.metadl.com/generate/images/881888/2026-01-04/52d0a8b6-f322-4cfd-a498-9fa0e8b2e79e.png"
              alt="Logo"
              className="h-16 w-16"
            />
          </div>
          <CardTitle className="text-2xl font-bold">3PL Warehouse System</CardTitle>
          <CardDescription>Sign in to access the warehouse management system</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Demo Login Buttons */}
          <div className="space-y-3 mb-6">
            <p className="text-sm font-medium text-gray-700 text-center">Quick Demo Access</p>
            <div className="grid gap-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleDemoLogin('dock')}
              >
                <Package className="h-5 w-5 text-blue-600" />
                <div className="text-left">
                  <div className="font-semibold">Dock Employee Demo</div>
                  <div className="text-xs text-gray-500">Receive and process deliveries</div>
                </div>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleDemoLogin('office')}
              >
                <Users className="h-5 w-5 text-green-600" />
                <div className="text-left">
                  <div className="font-semibold">Office Staff Demo</div>
                  <div className="text-xs text-gray-500">Manage slips, ASNs, and review</div>
                </div>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3"
                onClick={() => handleDemoLogin('admin')}
              >
                <Shield className="h-5 w-5 text-purple-600" />
                <div className="text-left">
                  <div className="font-semibold">Administrator Demo</div>
                  <div className="text-xs text-gray-500">Full access and settings</div>
                </div>
              </Button>
            </div>
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">Or sign in with credentials</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <Label>Select Your Role</Label>
              <RadioGroup value={role} onValueChange={(value) => setRole(value as UserRole)}>
                <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="dock" id="dock" />
                  <Label htmlFor="dock" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Package className="h-5 w-5 text-blue-600" />
                    <div>
                      <div className="font-semibold">Dock Employee</div>
                      <div className="text-xs text-gray-500">Receive and process deliveries</div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="office" id="office" />
                  <Label htmlFor="office" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Users className="h-5 w-5 text-green-600" />
                    <div>
                      <div className="font-semibold">Office Staff</div>
                      <div className="text-xs text-gray-500">Manage slips, ASNs, and review</div>
                    </div>
                  </Label>
                </div>

                <div className="flex items-center space-x-3 border rounded-lg p-3 cursor-pointer hover:bg-gray-50">
                  <RadioGroupItem value="admin" id="admin" />
                  <Label htmlFor="admin" className="flex items-center gap-3 cursor-pointer flex-1">
                    <Shield className="h-5 w-5 text-purple-600" />
                    <div>
                      <div className="font-semibold">Administrator</div>
                      <div className="text-xs text-gray-500">Full access and settings</div>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}