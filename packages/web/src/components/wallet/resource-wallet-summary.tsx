'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';

interface ResourceWallet {
  projectVouchers: number;
  facilitatorSeats: number;
  storytellerSeats: number;
}

interface ResourceWalletSummaryProps {
  className?: string;
  showActions?: boolean;
}

export default function ResourceWalletSummary({ 
  className = '', 
  showActions = true 
}: ResourceWalletSummaryProps) {
  const router = useRouter();
  const locale = useLocale();
  const [wallet, setWallet] = useState<ResourceWallet | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // TODO: Fetch actual wallet data from API
    // For now, using mock data
    setTimeout(() => {
      setWallet({
        projectVouchers: 0,
        facilitatorSeats: 0,
        storytellerSeats: 0
      });
      setLoading(false);
    }, 500);
  }, []);

  const handleViewDetails = () => {
    router.push(`/${locale}/dashboard/resources`);
  };

  const handlePurchaseMore = () => {
    router.push(`/${locale}/dashboard/purchase`);
  };

  if (loading) {
    return (
      <Card className={`p-4 animate-pulse ${className}`}>
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
        <div className="h-6 bg-gray-200 rounded w-2/3"></div>
      </Card>
    );
  }

  const hasLowResources = (wallet?.projectVouchers || 0) === 0 && 
                          (wallet?.facilitatorSeats || 0) === 0 && 
                          (wallet?.storytellerSeats || 0) === 0;

  return (
    <Card className={`responsive-padding ${className}`}>
      <div className="mobile-stack items-start sm:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Available Seats</h3>

          {/* Mobile: Stack vertically, Desktop: Inline */}
          <div className="mobile-stack sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 text-base sm:text-lg font-semibold text-gray-900">
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-blue-100 text-blue-800 text-sm font-medium">
                {wallet?.projectVouchers || 0} Project
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-green-100 text-green-800 text-sm font-medium">
                {wallet?.facilitatorSeats || 0} Facilitator
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded-md bg-purple-100 text-purple-800 text-sm font-medium">
                {wallet?.storytellerSeats || 0} Storyteller
              </span>
            </div>
          </div>

          {hasLowResources && (
            <div className="mt-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Low on seats
              </span>
            </div>
          )}
        </div>

        {showActions && (
          <div className="mobile-stack sm:flex-col gap-2 mobile-full sm:w-auto">
            <Button
              onClick={handleViewDetails}
              variant="outline"
              size="sm"
              className="mobile-full touch-target text-xs sm:text-sm"
            >
              View Details
            </Button>

            {hasLowResources && (
              <Button
                onClick={handlePurchaseMore}
                size="sm"
                className="mobile-full touch-target text-xs sm:text-sm bg-blue-600 hover:bg-blue-700 text-white"
              >
                Purchase More
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions for Empty State */}
      {hasLowResources && showActions && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <p className="text-sm text-gray-600 mb-4 mobile-center">
            You need seats to create projects and invite family members.
          </p>
          <Button
            onClick={handlePurchaseMore}
            className="mobile-full touch-target-large bg-blue-600 hover:bg-blue-700 text-white font-medium"
            size="lg"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Get The Saga Package
          </Button>
        </div>
      )}
    </Card>
  );
}