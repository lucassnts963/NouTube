import '@/lib/i18n'
import './global.css'

import { StatusBar } from 'expo-status-bar'
import { settings$ } from '@/states/settings'
import { Appearance, View, useColorScheme } from 'react-native'
import NouTubeViewModule from '@/modules/nou-tube-view'
import { useObserveEffect } from '@legendapp/state/react'
import { Slot } from 'expo-router'
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context'
import { useEffect } from 'react'
import * as SplashScreen from 'expo-splash-screen'
import {
  useFonts,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans'
import {
  IBMPlexMono_400Regular,
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono'

// Keep the splash up until the brand fonts (IBM Plex) are ready.
void SplashScreen.preventAutoHideAsync()

function RootLayoutContent() {
  useObserveEffect(settings$.theme, ({ value }) => {
    const nextColorScheme = value === 'dark' || value === 'light' ? value : Appearance.getColorScheme() === 'light' ? 'light' : 'dark'
    Appearance.setColorScheme?.(nextColorScheme)
    ;(NouTubeViewModule as any).setTheme?.(value)
  })

  useEffect(() => {
    return () => {
      ;(NouTubeViewModule as any).exit?.()
    }
  }, [])

  const insets = useSafeAreaInsets()
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'} style={{ height: insets.top, zIndex: 10 }} />
      <Slot />
      <View className={isDark ? 'bg-zinc-800' : 'bg-zinc-100'} style={{ height: insets.bottom }} />
    </>
  )
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  })

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync()
    }
  }, [fontsLoaded, fontError])

  if (!fontsLoaded && !fontError) {
    return null
  }

  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  )
}
