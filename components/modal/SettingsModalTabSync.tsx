import { TextInput, View, useColorScheme } from 'react-native'
import { useState } from 'react'
import { NouText } from '../NouText'
import { Image } from 'expo-image'
import { useValue } from '@legendapp/state/react'
import { auth$ } from '@/states/auth'
import { isIos, isWeb } from '@/lib/utils'
import { signOut } from '@/lib/supabase/auth'
import { supabase } from '@/lib/supabase/client'
import { getSyncServer, setSyncServer, resetSyncServer } from '@/lib/sync-config'
import { showToast } from '@/lib/toast'
import { NouLink } from '../link/NouLink'
import { NouButton } from '../button/NouButton'
import { NouMenu } from '../menu/NouMenu'
import { capitalize } from 'es-toolkit'
import { t } from 'i18next'
import { MaterialButton } from '../button/IconButtons'

const surfaceCls = 'overflow-hidden rounded-[24px] border border-zinc-300 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-900/70'
const sectionLabelCls = 'mb-2 px-1 text-[11px] uppercase tracking-[0.18em] text-zinc-600 dark:text-zinc-500'

const SettingsBadge: React.FC<{ label: string }> = ({ label }) => {
  return (
    <View className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-200 dark:bg-zinc-950 px-3 py-1">
      <NouText className="text-xs text-zinc-700 dark:text-zinc-300">{label}</NouText>
    </View>
  )
}

function formatPlanLabel(plan?: string) {
  return plan ? capitalize(plan) : 'Free'
}

const inputCls =
  'rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm text-zinc-900 dark:text-zinc-100'

const SyncServerSection = () => {
  const current = getSyncServer()
  const [url, setUrl] = useState(current.isCustom ? current.url : '')
  const [anonKey, setAnonKey] = useState(current.isCustom ? current.anonKey : '')
  const isDark = useColorScheme() !== 'light'

  const save = () => {
    if (!url.trim() || !anonKey.trim()) {
      showToast(t('sync.server.incomplete', 'Enter the server URL and anon key'))
      return
    }
    setSyncServer(url, anonKey)
    showToast(t('sync.server.saved', 'Saved — restart the app to apply'))
  }

  const reset = () => {
    resetSyncServer()
    setUrl('')
    setAnonKey('')
    showToast(t('sync.server.reset', 'Reset — restart the app to apply'))
  }

  return (
    <View>
      <NouText className={sectionLabelCls}>{t('sync.server.label', 'Sync server')}</NouText>
      <View className={surfaceCls}>
        <View className="gap-3 px-5 py-5">
          <NouText className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {t('sync.server.hint', 'Point sync at your own Supabase. Applies after restarting the app.')}
          </NouText>
          <TextInput
            className={inputCls}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://your-project.supabase.co"
            placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
          />
          <TextInput
            className={inputCls}
            value={anonKey}
            onChangeText={setAnonKey}
            autoCapitalize="none"
            placeholder={t('sync.server.anonKey', 'anon / publishable key')}
            placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
          />
          <View className="flex-row justify-end gap-3">
            {current.isCustom && (
              <NouButton variant="outline" onPress={reset}>
                {t('sync.server.useDefault', 'Use default')}
              </NouButton>
            )}
            <NouButton onPress={save}>{t('buttons.save', 'Save')}</NouButton>
          </View>
        </View>
      </View>
    </View>
  )
}

const EmailLoginSection = () => {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const isDark = useColorScheme() !== 'light'

  const send = async () => {
    const value = email.trim()
    if (!value.includes('@')) {
      showToast(t('sync.login.invalidEmail', 'Enter a valid email'))
      return
    }
    setSending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: value,
        options: { emailRedirectTo: 'noutube://auth', shouldCreateUser: true },
      })
      showToast(error ? error.message : t('sync.login.sent', 'Magic link sent — check your email'))
    } catch (e) {
      showToast((e as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <View>
      <NouText className={sectionLabelCls}>{t('sync.login.label', 'Sign in')}</NouText>
      <View className={surfaceCls}>
        <View className="gap-3 px-5 py-5">
          <NouText className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {t('sync.login.hint', 'Sign in with a magic link sent to your email.')}
          </NouText>
          <TextInput
            className={inputCls}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder={t('sync.login.email', 'you@example.com')}
            placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
            onSubmitEditing={() => void send()}
          />
          <View className="flex-row justify-end">
            <NouButton loading={sending} disabled={sending} onPress={() => void send()}>
              {t('sync.login.send', 'Send magic link')}
            </NouButton>
          </View>
        </View>
      </View>
    </View>
  )
}

export const SettingsModalTabSync = () => {
  const { user, plan } = useValue(auth$)
  const planLabel = formatPlanLabel(plan)

  if (!user) {
    if (isWeb) {
      return (
        <View className="gap-6">
          <View>
            <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
            <View className={surfaceCls}>
              <View className="px-5 py-5">
                <NouText className="text-lg font-semibold">{t('sync.label')}</NouText>
                <NouText className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
                <View className="mt-5">
                  <NouLink
                    className="rounded-full bg-zinc-900 px-5 py-2.5 text-center text-sm text-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                    href="https://noutube.inks.page/auth/app"
                    target="_blank"
                  >
                    Login NouTube
                  </NouLink>
                </View>
              </View>
            </View>
          </View>
        </View>
      )
    }

    return (
      <View className="gap-6">
        <SyncServerSection />
        <EmailLoginSection />
      </View>
    )
  }

  return (
    <View className="gap-6">
      <View>
        <NouText className={sectionLabelCls}>{t('sync.label')}</NouText>
        <View className={surfaceCls}>
          <View className="flex-row items-center gap-3 px-4 py-4">
            <Image
              style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#18181b' }}
              source={user.picture}
              contentFit="cover"
            />
            <View className="flex-1">
              <NouText className="font-medium">{user.email}</NouText>
              <NouText className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {t('sync.currentPlan')}: {planLabel}
              </NouText>
            </View>
            <NouMenu
              trigger={isWeb ? <MaterialButton name="more-vert" /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
              items={[{ label: t('buttons.signOut'), handler: signOut }]}
            />
          </View>
        </View>
      </View>

      <View>
        <NouText className={sectionLabelCls}>{t('sync.currentPlan')}</NouText>
        <View className={surfaceCls}>
          <View className="px-5 py-5">
            <View className="flex-row flex-wrap gap-2">
              <SettingsBadge label={planLabel} />
            </View>
            <NouText className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{t('sync.hint')}</NouText>
            <View className="mt-5">
              <NouLink
                className="rounded-full border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-950 px-5 py-2.5 text-center text-sm text-zinc-900 dark:text-zinc-100"
                href="https://noutube.inks.page/app"
              >
                {t('sync.managePlan')}
              </NouLink>
            </View>
          </View>
        </View>
      </View>

      {!isWeb && <SyncServerSection />}
    </View>
  )
}
