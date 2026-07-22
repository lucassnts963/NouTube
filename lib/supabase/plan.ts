import { auth$ } from '@/states/auth'
import { supabase } from './client'

/**
 * Fetch the signed-in user's plan from nou_profiles and store it on auth$.
 * Sync stays gated on a non-free plan; the admin grants premium server-side.
 */
export async function refreshPlan() {
  try {
    const { data, error } = (await supabase.from('nou_profiles').select('plan').single()) as unknown as {
      data: { plan?: string } | null
      error: unknown
    }
    auth$.plan.set(error ? undefined : data?.plan)
  } catch {
    auth$.plan.set(undefined)
  }
}
