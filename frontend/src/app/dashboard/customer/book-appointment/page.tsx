'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function BookAppointmentRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to new appointments page
    router.replace('/dashboard/customer/appointments');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle className="text-center">در حال انتقال...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <Loader2 className="h-12 w-12 animate-spin text-main-orange" />
        </CardContent>
      </Card>
    </div>
  );
}
