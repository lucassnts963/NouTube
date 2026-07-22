import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { getSyncServer } from '../sync-config'

// Endpoint is read once at boot from the in-app sync config (Settings → Sync),
// falling back to the build-time env / default. Changing it applies on restart.
const { url, anonKey } = getSyncServer()

export const supabase = createClient(url, anonKey, {
  auth: {
    // https://github.com/supabase/supabase-js/issues/870#issuecomment-1746699664
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})
