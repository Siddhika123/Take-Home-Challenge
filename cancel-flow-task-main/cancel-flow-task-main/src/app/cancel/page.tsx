'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

// Mock user data
const MOCK_USER = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  email: 'user1@example.com',
  name: 'Mihailo',
  subscription: {
    id: 'sub-1',
    monthly_price: 2500, // $25.00 in cents
    status: 'active' as const
  }
}

// A/B test variants
type ABVariant = 'A' | 'B'

// Flow steps
type FlowStep = 'initial' | 'reasons' | 'downsell' | 'confirm' | 'complete'

// Cancellation reasons
const CANCELLATION_REASONS = [
  'Too expensive',
  'Not using it enough',
  'Found a better alternative',
  'Technical issues',
  'Poor customer service',
  'Other'
]

export default function CancelFlow() {
  const [currentStep, setCurrentStep] = useState<FlowStep>('initial')
  const [variant, setVariant] = useState<ABVariant | null>(null)
  const [selectedReason, setSelectedReason] = useState<string>('')
  const [acceptedDownsell, setAcceptedDownsell] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)

  // Deterministic A/B testing - assign variant once and persist
  useEffect(() => {
    const initializeVariant = async () => {
      try {
        // Check if user already has a cancellation record with a variant
        const { data: existingCancellation } = await supabase
          .from('cancellations')
          .select('downsell_variant')
          .eq('user_id', MOCK_USER.id)
          .single()

        if (existingCancellation?.downsell_variant) {
          setVariant(existingCancellation.downsell_variant as ABVariant)
        } else {
          // Generate deterministic variant using crypto.getRandomValues (secure RNG)
          const array = new Uint8Array(1)
          crypto.getRandomValues(array)
          const randomVariant: ABVariant = array[0] % 2 === 0 ? 'A' : 'B'
          setVariant(randomVariant)
        }
      } catch (error) {
        console.error('Error initializing variant:', error)
        // Fallback to client-side randomization
        const randomVariant: ABVariant = Math.random() < 0.5 ? 'A' : 'B'
        setVariant(randomVariant)
      }
    }

    initializeVariant()
  }, [])

  const handleStartCancellation = () => {
    setCurrentStep('reasons')
  }

  const handleReasonSelection = (reason: string) => {
    setSelectedReason(reason)
    
    // Variant A: Skip downsell, go straight to confirm
    // Variant B: Show downsell offer
    if (variant === 'A') {
      setCurrentStep('confirm')
    } else {
      setCurrentStep('downsell')
    }
  }

  const handleDownsellAccept = async () => {
    setAcceptedDownsell(true)
    setIsLoading(true)
    
    try {
      // Log the downsell acceptance
      await supabase.from('cancellations').insert({
        user_id: MOCK_USER.id,
        subscription_id: MOCK_USER.subscription.id,
        downsell_variant: variant,
        reason: selectedReason,
        accepted_downsell: true
      })
      
      // Stub: In real implementation, this would process the payment update
      console.log('Downsell accepted - redirect to profile page')
      
      // Simulate redirect back to profile
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
      
    } catch (error) {
      console.error('Error processing downsell acceptance:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownsellDecline = () => {
    setAcceptedDownsell(false)
    setCurrentStep('confirm')
  }

  const handleFinalCancellation = async () => {
    setIsLoading(true)
    
    try {
      // Update subscription status
      await supabase
        .from('subscriptions')
        .update({ status: 'pending_cancellation' })
        .eq('id', MOCK_USER.subscription.id)

      // Create cancellation record
      await supabase.from('cancellations').insert({
        user_id: MOCK_USER.id,
        subscription_id: MOCK_USER.subscription.id,
        downsell_variant: variant,
        reason: selectedReason,
        accepted_downsell: acceptedDownsell
      })

      setCurrentStep('complete')
    } catch (error) {
      console.error('Error processing cancellation:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const getDiscountedPrice = () => {
    const originalPrice = MOCK_USER.subscription.monthly_price
    return originalPrice - 1000 // $10 off
  }

  if (!variant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        
        {/* Initial Step */}
        {currentStep === 'initial' && (
          <div className="p-8 text-center">
            <div className="mb-6">
              <img 
                src="/empire-state-compressed.jpg" 
                alt="Empire State Building" 
                className="w-full h-48 object-cover rounded-lg"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              We're sorry to see you go!
            </h1>
            <p className="text-gray-600 mb-8">
              Before you cancel, help us understand why you're leaving so we can improve.
            </p>
            <button 
              onClick={handleStartCancellation}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Continue with Cancellation
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full mt-3 bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Never mind, go back
            </button>
          </div>
        )}

        {/* Reason Selection Step */}
        {currentStep === 'reasons' && (
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              What's your main reason for canceling?
            </h2>
            <div className="space-y-3">
              {CANCELLATION_REASONS.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleReasonSelection(reason)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                >
                  {reason}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Downsell Step (Variant B only) */}
        {currentStep === 'downsell' && variant === 'B' && (
          <div className="p-8 text-center">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Wait! We have a special offer for you
            </h2>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
              <div className="text-3xl font-bold text-green-600 mb-2">
                $10 OFF
              </div>
              <div className="text-gray-600">
                <span className="line-through">
                  ${(MOCK_USER.subscription.monthly_price / 100).toFixed(2)}/month
                </span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                ${(getDiscountedPrice() / 100).toFixed(2)}/month
              </div>
              <p className="text-sm text-gray-500 mt-2">
                This special pricing is available for the next 6 months
              </p>
            </div>
            <button 
              onClick={handleDownsellAccept}
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-green-700 transition-colors mb-3 disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : 'Accept this offer'}
            </button>
            <button 
              onClick={handleDownsellDecline}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              No thanks, continue canceling
            </button>
          </div>
        )}

        {/* Final Confirmation Step */}
        {currentStep === 'confirm' && (
          <div className="p-8 text-center">
            <div className="mb-6">
              <img 
                src="/mihailo-profile.jpeg" 
                alt="Profile" 
                className="w-16 h-16 rounded-full mx-auto mb-4"
              />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Are you sure, {MOCK_USER.name}?
            </h2>
            <p className="text-gray-600 mb-2">
              Your subscription will be canceled and you'll lose access to:
            </p>
            <ul className="text-left text-gray-600 mb-6 space-y-1">
              <li>• Premium migration tools</li>
              <li>• Priority customer support</li>
              <li>• Advanced analytics</li>
              <li>• Unlimited transfers</li>
            </ul>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-yellow-800">
                <strong>Reason:</strong> {selectedReason}
              </p>
            </div>
            <button 
              onClick={handleFinalCancellation}
              disabled={isLoading}
              className="w-full bg-red-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-red-700 transition-colors mb-3 disabled:opacity-50"
            >
              {isLoading ? 'Canceling...' : 'Yes, cancel my subscription'}
            </button>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              Keep my subscription
            </button>
          </div>
        )}

        {/* Completion Step */}
        {currentStep === 'complete' && (
          <div className="p-8 text-center">
            <div className="mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Subscription Canceled
            </h2>
            <p className="text-gray-600 mb-6">
              Your subscription has been marked for cancellation. You'll continue to have access until the end of your current billing period.
            </p>
            <button 
              onClick={() => window.location.href = '/'}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Return to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
