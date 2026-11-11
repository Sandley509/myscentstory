'use server';

import { action, requireStaff } from '@/lib/admin/auth';
import { isMissingAnalytics, type LiveView } from '@/lib/analytics';

/** Visitors active in the last 5 minutes (polled by the live view). */
export async function getLiveView() {
  return action(async () => {
    const { supabase } = await requireStaff();
    const { data, error } = await supabase.rpc('analytics_live');
    if (error) {
      throw new Error(
        isMissingAnalytics(error.message)
          ? 'Analytics isn’t set up yet: run supabase/migrations/0005_analytics_abandoned_carts.sql in Supabase.'
          : error.message
      );
    }
    return data as LiveView;
  });
}
