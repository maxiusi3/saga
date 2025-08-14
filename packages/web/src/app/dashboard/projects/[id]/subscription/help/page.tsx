'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '../../../../../../components/ui/button';
import { SubscriptionHelpCenter } from '../../../../../../components/subscription/subscription-help-center';
import { ArrowLeft } from 'lucide-react';

export default function SubscriptionHelpPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center space-x-4 mb-8">
        <Button
          onClick={() => router.push(`/dashboard/projects/${projectId}/subscription`)}
          variant="outline"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Subscription
        </Button>
      </div>

      {/* Help Center */}
      <SubscriptionHelpCenter />
    </div>
  );
}