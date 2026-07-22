// Web/desktop: the sync endpoint comes from the build-time env (Vite). An
// in-app override is native-only for now, so these are read-only here.
export const DEFAULT_SUPABASE_URL =
  (import.meta as any)?.env?.VITE_SUPABASE_URL || 'https://pgukcvgypvjwtibzlvhr.supabase.co'

export const DEFAULT_SUPABASE_ANON_KEY =
  (import.meta as any)?.env?.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBndWtjdmd5cHZqd3RpYnpsdmhyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTI0NTIzODQsImV4cCI6MjAyODAyODM4NH0.zoxse4Kay_svHlQOiAINZm1lPIFPJMZAY8RKZUDSQrs'

export interface SyncServer {
  url: string
  anonKey: string
  isCustom: boolean
}

export function getSyncServer(): SyncServer {
  return { url: DEFAULT_SUPABASE_URL, anonKey: DEFAULT_SUPABASE_ANON_KEY, isCustom: false }
}

export function setSyncServer(_url: string, _anonKey: string) {}

export function resetSyncServer() {}
