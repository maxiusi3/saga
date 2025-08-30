'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export default function PurchasePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handlePurchase = async () => {
    setLoading(true);
    
    try {
      // TODO: Integrate with actual payment processing (Stripe)
      // For now, simulate purchase process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Redirect to success page
      router.push('/dashboard/purchase/success');
    } catch (error) {
      console.error('Purchase failed:', error);
      setLoading(false);
    }
  };

  const handleRestorePurchase = () => {
    // TODO: Implement restore purchase for mobile compliance
    console.log('Restore purchase clicked');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">The Saga Package</h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to start capturing your family's stories
          </p>
        </div>

        {/* Package Details */}
        <div className="max-w-4xl mx-auto">
          <Card className="p-8">
            <div className="text-center mb-8">
              <div className="text-6xl font-bold text-blue-600 mb-2">$29</div>
              <div className="text-gray-500">One-time purchase</div>
            </div>

            <div className="grid md:grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">What's Included:</h3>
                <ul className="space-y-2">
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    1 Project Creation Voucher
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    2 Facilitator Seats
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    8 Storyteller Seats
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Unlimited Story Recording
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    AI-Powered Transcription
                  </li>
                  <li className="flex items-center">
                    <span className="text-green-500 mr-2">✓</span>
                    Story Export & Sharing
                  </li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Perfect For:</h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• Families wanting to preserve memories</li>
                  <li>• Multi-generational storytelling</li>
                  <li>• Creating lasting family legacies</li>
                  <li>• Connecting distant family members</li>
                  <li>• Documenting family history</li>
                </ul>
              </div>
            </div>

            <div className="text-center space-y-4">
              <Button 
                onClick={handlePurchase}
                disabled={loading}
                className="w-full md:w-auto px-8 py-3 text-lg"
              >
                {loading ? 'Processing...' : 'Purchase Now - $29'}
              </Button>
              
              <div>
                <button
                  onClick={handleRestorePurchase}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Restore Previous Purchase
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
