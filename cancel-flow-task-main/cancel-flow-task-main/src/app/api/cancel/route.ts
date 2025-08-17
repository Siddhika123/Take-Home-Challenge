// API route for handling cancellation flow
import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '../../../lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, ...data } = body

    switch (action) {
      case 'get_variant':
        return await getOrCreateVariant(data.userId)
      
      case 'cancel_subscription':
        return await cancelSubscription(data)
      
      case 'accept_downsell':
        return await acceptDownsell(data)
      
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function getOrCreateVariant(userId: string) {
  try {
    // Check if user already has a cancellation record
    const { data: existingCancellation } = await supabase
      .from('cancellations')
      .select('downsell_variant')
      .eq('user_id', userId)
      .single()

    if (existingCancellation?.downsell_variant) {
      return NextResponse.json({ variant: existingCancellation.downsell_variant })
    }

    // Generate new variant using secure random
    const array = new Uint8Array(1)
    crypto.getRandomValues(array)
    const variant = array[0] % 2 === 0 ? 'A' : 'B'

    return NextResponse.json({ variant })
  } catch (error) {
    // If no existing record, generate new variant
    const array = new Uint8Array(1)
    crypto.getRandomValues(array)
    const variant = array[0] % 2 === 0 ? 'A' : 'B'
    
    return NextResponse.json({ variant })
  }
}

async function cancelSubscription(data: any) {
  const { userId, subscriptionId, variant, reason, acceptedDownsell } = data

  try {
    // Update subscription status
    const { error: subscriptionError } = await supabase
      .from('subscriptions')
      .update({ 
        status: 'pending_cancellation',
        updated_at: new Date().toISOString()
      })
      .eq('id', subscriptionId)

    if (subscriptionError) {
      throw subscriptionError
    }

    // Create cancellation record
    const { data: cancellationData, error: cancellationError } = await supabase
      .from('cancellations')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        downsell_variant: variant,
        reason: reason,
        accepted_downsell: acceptedDownsell
      })
      .select()

    if (cancellationError) {
      throw cancellationError
    }

    return NextResponse.json({ 
      success: true, 
      cancellation: cancellationData[0] 
    })
  } catch (error) {
    throw error
  }
}

async function acceptDownsell(data: any) {
  const { userId, subscriptionId, variant, reason } = data

  try {
    // In a real implementation, this would process the payment update
    // For now, we'll just log the downsell acceptance
    
    const { data: cancellationData, error } = await supabase
      .from('cancellations')
      .insert({
        user_id: userId,
        subscription_id: subscriptionId,
        downsell_variant: variant,
        reason: reason,
        accepted_downsell: true
      })
      .select()

    if (error) {
      throw error
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Downsell accepted',
      cancellation: cancellationData[0]
    })
  } catch (error) {
    throw error
  }
}
