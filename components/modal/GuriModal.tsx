import { useState } from 'react'
import { ScrollView, TextInput, View, useColorScheme } from 'react-native'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { BaseModal } from './BaseModal'
import { PinGate } from './PinGate'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { NouSwitch } from '../switch/NouSwitch'
import { ui$ } from '@/states/ui'
import { guri$ } from '@/states/guri'
import { isValidGuriPin } from '@/lib/guri'
import { showToast } from '@/lib/toast'

const PinInput: React.FC<{ value: string; onChangeText: (v: string) => void; placeholder: string }> = ({
  value,
  onChangeText,
  placeholder,
}) => {
  const isDark = useColorScheme() !== 'light'
  return (
    <TextInput
      className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 text-lg tracking-widest text-zinc-900 dark:text-zinc-100"
      value={value}
      onChangeText={(v) => onChangeText(v.replace(/\D/g, '').slice(0, 8))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={8}
      placeholder={placeholder}
      placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
    />
  )
}

const Toggles = () => {
  const restrictedMode = useValue(guri$.restrictedMode)
  const hideShorts = useValue(guri$.hideShorts)
  const hideSearch = useValue(guri$.hideSearch)
  const hideComments = useValue(guri$.hideComments)
  const hideRecommendations = useValue(guri$.hideRecommendations)

  return (
    <View className="gap-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
      <NouSwitch
        label={t('guri.restrictedMode', 'Force YouTube Restricted Mode')}
        value={restrictedMode}
        onPress={() => guri$.setFlag('restrictedMode', !restrictedMode)}
      />
      <NouSwitch
        label={t('guri.hideShorts', 'Hide Shorts')}
        value={hideShorts}
        onPress={() => guri$.setFlag('hideShorts', !hideShorts)}
      />
      <NouSwitch
        label={t('guri.hideSearch', 'Hide search')}
        value={hideSearch}
        onPress={() => guri$.setFlag('hideSearch', !hideSearch)}
      />
      <NouSwitch
        label={t('guri.hideComments', 'Hide comments')}
        value={hideComments}
        onPress={() => guri$.setFlag('hideComments', !hideComments)}
      />
      <NouSwitch
        label={t('guri.hideRecommendations', 'Hide recommendations')}
        value={hideRecommendations}
        onPress={() => guri$.setFlag('hideRecommendations', !hideRecommendations)}
      />
    </View>
  )
}

export const GuriModal = () => {
  const open = useValue(ui$.guriModalOpen)
  const enabled = useValue(guri$.enabled)
  const unlocked = useValue(ui$.guriUnlocked)

  const [pin, setPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [changingPin, setChangingPin] = useState(false)

  const close = () => ui$.guriModalOpen.set(false)

  if (!open) return null

  // Locked: require the PIN before showing/changing anything.
  if (enabled && !unlocked) {
    return (
      <BaseModal onClose={close}>
        <PinGate
          verify={(p) => guri$.verifyPin(p)}
          onUnlock={() => ui$.guriUnlocked.set(true)}
          onCancel={close}
        />
      </BaseModal>
    )
  }

  const onEnable = () => {
    if (!isValidGuriPin(pin)) {
      showToast(t('guri.pinTooShort', 'PIN must be 4 to 8 digits'))
      return
    }
    if (pin !== confirmPin) {
      showToast(t('guri.pinMismatch', 'PINs do not match'))
      return
    }
    guri$.enable(pin)
    ui$.guriUnlocked.set(true)
    setPin('')
    setConfirmPin('')
    showToast(t('guri.enabled', 'Modo guri enabled'))
  }

  const onChangePin = () => {
    if (!isValidGuriPin(pin)) {
      showToast(t('guri.pinTooShort', 'PIN must be 4 to 8 digits'))
      return
    }
    if (pin !== confirmPin) {
      showToast(t('guri.pinMismatch', 'PINs do not match'))
      return
    }
    guri$.pin.set(pin)
    setPin('')
    setConfirmPin('')
    setChangingPin(false)
    showToast(t('guri.pinChanged', 'PIN updated'))
  }

  const onDisable = () => {
    // Already unlocked this session, so disabling is allowed directly.
    guri$.enabled.set(false)
    showToast(t('guri.disabled', 'Modo guri disabled'))
  }

  return (
    <BaseModal onClose={close}>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-5" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center gap-3">
          <View className="h-11 w-11 items-center justify-center rounded-full bg-accent-tint">
            <MaterialIcons name="child-care" size={24} color="#E5484D" />
          </View>
          <View className="flex-1">
            <NouText className="text-lg font-semibold">{t('guri.title', 'Modo guri')}</NouText>
            <NouText className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('guri.subtitle', 'Parental controls for a safer YouTube')}
            </NouText>
          </View>
        </View>

        <Toggles />

        {!enabled ? (
          <View className="gap-3">
            <NouText className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
              {t('guri.setPin', 'Set a PIN to lock these settings')}
            </NouText>
            <PinInput value={pin} onChangeText={setPin} placeholder={t('guri.pin', 'PIN')} />
            <PinInput
              value={confirmPin}
              onChangeText={setConfirmPin}
              placeholder={t('guri.confirmPin', 'Confirm PIN')}
            />
            <NouButton onPress={onEnable}>{t('guri.enable', 'Enable modo guri')}</NouButton>
          </View>
        ) : (
          <View className="gap-3">
            {changingPin ? (
              <View className="gap-3">
                <PinInput value={pin} onChangeText={setPin} placeholder={t('guri.newPin', 'New PIN')} />
                <PinInput
                  value={confirmPin}
                  onChangeText={setConfirmPin}
                  placeholder={t('guri.confirmPin', 'Confirm PIN')}
                />
                <View className="flex-row justify-end gap-3">
                  <NouButton
                    variant="outline"
                    onPress={() => {
                      setChangingPin(false)
                      setPin('')
                      setConfirmPin('')
                    }}
                  >
                    {t('buttons.cancel', 'Cancel')}
                  </NouButton>
                  <NouButton onPress={onChangePin}>{t('buttons.save', 'Save')}</NouButton>
                </View>
              </View>
            ) : (
              <NouButton variant="outline" onPress={() => setChangingPin(true)}>
                {t('guri.changePin', 'Change PIN')}
              </NouButton>
            )}
            <NouButton variant="outline" onPress={onDisable}>
              {t('guri.disable', 'Disable modo guri')}
            </NouButton>
          </View>
        )}
      </ScrollView>
    </BaseModal>
  )
}
