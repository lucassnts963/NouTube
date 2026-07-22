import { useState } from 'react'
import { TextInput, View, useColorScheme } from 'react-native'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { t } from 'i18next'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'

/**
 * Numeric PIN entry used to guard "modo guri" (parental controls). Renders its
 * own centered card; the caller decides where to show it.
 */
export const PinGate: React.FC<{
  title?: string
  description?: string
  verify: (pin: string) => boolean
  onUnlock: () => void
  onCancel?: () => void
}> = ({ title, description, verify, onUnlock, onCancel }) => {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const isDark = useColorScheme() !== 'light'

  const submit = () => {
    if (verify(pin)) {
      setPin('')
      setError(false)
      onUnlock()
    } else {
      setError(true)
      setPin('')
    }
  }

  return (
    <View className="flex-1 items-center justify-center px-8 gap-5">
      <View className="h-16 w-16 items-center justify-center rounded-full bg-accent-tint">
        <MaterialIcons name="lock" size={30} color="#E5484D" />
      </View>
      <View className="items-center gap-1">
        <NouText className="text-lg font-semibold">{title || t('guri.locked', 'Parental lock')}</NouText>
        <NouText className="text-sm text-center text-zinc-500 dark:text-zinc-400">
          {description || t('guri.enterPin', 'Enter the PIN to continue')}
        </NouText>
      </View>
      <TextInput
        className="w-40 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-center text-2xl tracking-[8px] text-zinc-900 dark:text-zinc-100"
        value={pin}
        onChangeText={(v) => {
          setError(false)
          setPin(v.replace(/\D/g, '').slice(0, 8))
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={8}
        autoFocus
        onSubmitEditing={submit}
        placeholder="••••"
        placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
      />
      {error && (
        <NouText className="text-sm text-primary">{t('guri.wrongPin', 'Wrong PIN, try again')}</NouText>
      )}
      <View className="flex-row gap-3">
        {onCancel && (
          <NouButton variant="outline" onPress={onCancel}>
            {t('buttons.cancel', 'Cancel')}
          </NouButton>
        )}
        <NouButton disabled={pin.length < 4} onPress={submit}>
          {t('guri.unlock', 'Unlock')}
        </NouButton>
      </View>
    </View>
  )
}
