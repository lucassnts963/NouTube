import { createMMKV } from 'react-native-mmkv'

// Where the Supabase sync endpoint lives. Read at startup by the Supabase
// client; the Settings UI writes here. Changing it takes effect on app restart
// (the client is created once at boot).
const storage = createMMKV({ id: 'guri-sync-config' })

export const DEFAULT_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://pgukcvgypvjwtibzlvhr.supabase.co'

export const DEFAULT_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWtjdmd5cHZqd3RpYnpsdmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI0NTIzODQsImV4cCI6MjAyODAyODM4NH0.zoxse4Kay_svHlQOiAINZm1lPIFPJMZAY8RKZUDSQrs'

export interface SyncServer {
  url: string
  anonKey: string
  isCustom: boolean
}

export function getSyncServer(): SyncServer {
  const url = storage.getString('url')?.trim()
  const anonKey = storage.getString('anonKey')?.trim()
  if (url && anonKey) {
    return { url, anonKey, isCustom: true }
  }
  return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY, isCustom: false }
}

export function setSyncServer(url: string, anonKey: string) {
  storage.set('url', url.trim())
  storage.set('anonKey', anonKey.trim())
}

export function resetSyncServer() {
  storage.remove('url')
  storage.remove('anonKey')
}
