import 'ts-node/register'

import { ExpoConfig } from 'expo/config'
import { version, versionCode } from './package.json'

const intentFilters = [
  {
    autoVerify: false,
    action: 'VIEW',
    data: ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'www.youtube.com', 'youtu.be'].map((host) => ({
      scheme: 'https',
      host,
    })),
    category: ['BROWSABLE', 'DEFAULT'],
  },
]

module.exports = ({ config }: { config: ExpoConfig }) => {
  return {
    name: 'GuriTube',
    slug: 'guritube',
    version,
    icon: './assets/images/icon.png',
    // Keep the custom URL scheme as 'noutube': it's not user-visible and is
    // wired to the auth deeplink (noutube:auth) + the Supabase OAuth redirect,
    // so renaming it would break login/sync until the server redirect changes.
    scheme: 'noutube',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'jp.nonbili.noutube',
    },
    android: {
      versionCode,
      permissions: ['RECORD_AUDIO', 'MODIFY_AUDIO_SETTINGS'],
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        monochromeImage: './assets/images/monochrome-icon.png',
        backgroundColor: '#ffffff',
      },
      predictiveBackGestureEnabled: false,
      package: 'jp.nonbili.noutube',
      intentFilters,
    },
    web: {
      bundler: 'metro',
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      './plugins/withAndroidPlugin.ts',
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#f9fafb',
          dark: {
            image: './assets/images/splash-icon.png',
            backgroundColor: '#27272a',
          },
        },
      ],
      'expo-asset',
      'expo-font',
      'expo-status-bar',
      'expo-image',
      [
        'expo-localization',
        {
          supportedLocales: ['en', 'de', 'es', 'fr', 'id', 'ja', 'pl', 'pt', 'pt-BR', 'ru', 'tr', 'uk', 'vi', 'zh-Hans', 'zh-Hant'],
        },
      ],
      [
        'expo-sharing',
        {
          android: {
            enabled: true,
            singleShareMimeTypes: ['text/*'],
          },
        },
      ],
      'expo-web-browser',
      [
        'expo-video',
        {
          supportsBackgroundPlayback: true,
          supportsPictureInPicture: true,
        },
      ],
    ],
    experiments: {
      typedRoutes: true,
    },
  }
}
