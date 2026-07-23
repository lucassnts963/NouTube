import { ActivityIndicator, Pressable, ScrollView, View, useColorScheme } from 'react-native'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { useValue } from '@legendapp/state/react'
import { importProgress$ } from '@/states/importProgress'
import { NouText } from '../NouText'
import { BaseModal } from './BaseModal'
import { clsx, nIf } from '@/lib/utils'
import { t } from 'i18next'

export const ImportProgressModal = () => {
  const open = useValue(importProgress$.open)
  const finished = useValue(importProgress$.finished)
  const steps = useValue(importProgress$.steps)
  const colorScheme = useColorScheme()
  const isDark = colorScheme !== 'light'

  return nIf(
    open,
    <BaseModal onClose={() => importProgress$.close()}>
      <View className="mt-3 mb-4 px-4 flex-row items-center justify-between">
        <NouText className="font-semibold text-lg">{t('modals.importProgress', 'Importing Takeout data')}</NouText>
        <Pressable onPress={() => importProgress$.close()} hitSlop={10}>
          <MaterialIcons name="close" size={20} color={isDark ? '#a1a1aa' : '#52525b'} />
        </Pressable>
      </View>
      <ScrollView className="flex-1" contentContainerClassName="px-4 pb-6 gap-3">
        {steps.map((step) => {
          const pct = step.total > 0 ? Math.min(100, Math.round((step.done / step.total) * 100)) : 0
          return (
            <View
              key={step.id}
              className={clsx(
                'rounded-xl border p-4 gap-2',
                step.status === 'done' && 'border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900',
                step.status === 'error' && 'border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30',
                step.status === 'active' && 'border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30',
              )}
            >
              <View className="flex-row items-center justify-between gap-3">
                <NouText className="flex-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100" numberOfLines={1}>
                  {step.label}
                </NouText>
                {nIf(step.status === 'error', <MaterialIcons name="error-outline" size={18} color={isDark ? '#f87171' : '#dc2626'} />)}
                {nIf(step.status === 'done', <MaterialIcons name="check-circle" size={18} color={isDark ? '#86efac' : '#16a34a'} />)}
                {nIf(step.status === 'active', <ActivityIndicator size="small" color={isDark ? '#7dd3fc' : '#0284c7'} />)}
              </View>
              {step.status === 'active' && step.total > 0 && (
                <>
                  <View className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950">
                    <View className="h-full rounded-full bg-sky-500 dark:bg-sky-400" style={{ width: `${Math.max(2, pct)}%` }} />
                  </View>
                  <NouText className="text-xs text-sky-700 dark:text-sky-200 font-mono">
                    {step.done.toLocaleString()} / {step.total.toLocaleString()}
                  </NouText>
                </>
              )}
              {step.status === 'active' && step.total === 0 && (
                <NouText className="text-xs text-sky-700 dark:text-sky-200">
                  {t('modals.importReading', 'Reading file…')}
                </NouText>
              )}
              {step.resultLabel ? (
                <NouText className="text-xs text-zinc-500 dark:text-zinc-400">{step.resultLabel}</NouText>
              ) : null}
            </View>
          )
        })}
        {finished && (
          <Pressable
            onPress={() => importProgress$.close()}
            className="mt-2 items-center rounded-xl bg-zinc-200 dark:bg-zinc-800 py-3 active:bg-zinc-300 dark:active:bg-zinc-700"
          >
            <NouText className="font-semibold text-sm">{t('buttons.done', 'Done')}</NouText>
          </Pressable>
        )}
      </ScrollView>
    </BaseModal>,
  )
}
