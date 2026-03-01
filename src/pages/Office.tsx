import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Monitor } from 'lucide-react';

export default function Office() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Office Review</h1>
          <p className="text-gray-600 mt-1">Review deliveries and communicate with dock staff</p>
        </div>
        <Monitor className="h-12 w-12 text-gray-400" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Office Portal - Coming Soon</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            This section will show live receiving sessions, allow communication with dock employees,
            and provide review/approval functionality before syncing to Extensiv.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
