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
      <div className="container-responsive responsive-padding">
        {/* Header */}
        <div className="mobile-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4">The Saga Package</h1>
          <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Everything you need to start capturing your family's stories
          </p>
        </div>

        <div className="grid-responsive-2 gap-8 lg:gap-12">
          {/* Value Proposition Section */}
          <div className="order-2 lg:order-1">
            <h2 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-6">What's Included</h2>
          
          <div className="space-y-4 mb-8">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">1 Project Voucher</h3>
                <p className="text-sm text-gray-600">Create a dedicated space for one family member's stories</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">2 Facilitator Seats</h3>
                <p className="text-sm text-gray-600">Invite siblings to collaborate on the project</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">2 Storyteller Seats</h3>
                <p className="text-sm text-gray-600">Invite family members to share their stories</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-yellow-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">1 Year Interactive Service</h3>
                <p className="text-sm text-gray-600">AI-powered prompts, real-time interactions, and story curation</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-indigo-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Permanent Archival Access</h3>
                <p className="text-sm text-gray-600">Keep access to all stories forever, even after subscription ends</p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-gray-900">Full Data Export</h3>
                <p className="text-sm text-gray-600">Download all stories, photos, and transcripts anytime</p>
              </div>
            </div>
          </div>

          {/* Additional Benefits */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-medium text-gray-900 mb-3">Why Choose Saga?</h3>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• AI-powered conversation prompts tailored to your family</li>
              <li>• High-quality audio recording and transcription</li>
              <li>• Secure, private family sharing</li>
              <li>• Professional-grade story curation and organization</li>
              <li>• Mobile app for easy story recording</li>
              <li>• Web dashboard for family collaboration</li>
            </ul>
          </div>
        </div>

        {/* Purchase Card */}
        <div className="order-1 lg:order-2">
          <Card className="responsive-padding lg:sticky lg:top-8 shadow-lg border-2 border-blue-100">
            <div className="mobile-center mb-6">
              <div className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-2">$129</div>
              <p className="text-gray-600 text-base sm:text-lg">One-time purchase</p>
            </div>

            <div className="space-y-4 mb-6">
              <Button
                onClick={handlePurchase}
                disabled={loading}
                className="w-full touch-target-large bg-blue-600 hover:bg-blue-700 text-white py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </div>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Purchase Now
                  </>
                )}
              </Button>

              <button
                onClick={handleRestorePurchase}
                className="w-full touch-target text-sm text-gray-600 hover:text-gray-800 underline focus-visible"
              >
                Restore Purchase
              </button>
            </div>

            {/* Security & Guarantee Info */}
            <div className="border-t pt-6">
              <div className="text-xs sm:text-sm text-gray-500 space-y-2">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Secure payment processing</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>30-day money-back guarantee</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Stories remain accessible forever</span>
                </div>
              </div>
            </div>

            {/* Terms */}
            <div className="mt-6 pt-6 border-t">
              <p className="text-xs text-gray-500 mobile-center leading-relaxed">
                By purchasing, you agree to our{' '}
                <a href="/terms" className="text-blue-600 hover:underline focus-visible">Terms of Service</a>
                {' '}and{' '}
                <a href="/privacy" className="text-blue-600 hover:underline focus-visible">Privacy Policy</a>
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}