import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View, useColorScheme } from 'react-native'
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
import { useActivePageUrl } from '@/lib/hooks/useActivePageUrl'

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

const AllowListSection = () => {
  const allowListMode = useValue(guri$.allowListMode)
  const allowList = useValue(guri$.allowList)
  const activePageUrl = useActivePageUrl()
  const [url, setUrl] = useState('')
  const isDark = useColorScheme() !== 'light'

  const add = (candidate: string) => {
    if (!guri$.addAllowItem(candidate)) {
      showToast(t('guri.allowInvalid', 'Paste a channel or playlist link'))
      return
    }
    setUrl('')
    showToast(t('guri.allowAdded', 'Added to the allow-list'))
  }

  return (
    <View className="gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4">
      <NouSwitch
        label={t('guri.allowListMode', "Only these (allow-list)")}
        value={allowListMode}
        onPress={() => guri$.setFlag('allowListMode', !allowListMode)}
      />
      <NouText className="text-xs text-zinc-500 dark:text-zinc-400">
        {t('guri.allowListHint', 'When on, only the channels and playlists below (and their videos) can be opened.')}
      </NouText>

      {allowListMode && (
        <View className="gap-3">
          {allowList.length === 0 ? (
            <NouText className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('guri.allowEmpty', 'No allowed channels or playlists yet.')}
            </NouText>
          ) : (
            <View className="gap-2">
              {allowList.map((item) => (
                <View
                  key={item.id}
                  className="flex-row items-center gap-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 px-3 py-2"
                >
                  <MaterialIcons
                    name={item.type === 'playlist' ? 'playlist-play' : 'account-circle'}
                    size={18}
                    color="#E5484D"
                  />
                  <NouText className="flex-1 text-sm" numberOfLines={1}>
                    {item.title}
                  </NouText>
                  <Pressable onPress={() => guri$.removeAllowItem(item.id)} className="p-1">
                    <MaterialIcons name="close" size={18} color={isDark ? '#a1a1aa' : '#71717a'} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          <TextInput
            className="rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
            keyboardType="url"
            placeholder={t('guri.allowPlaceholder', 'Channel or playlist link')}
            placeholderTextColor={isDark ? '#52525b' : '#a1a1aa'}
            onSubmitEditing={() => url.trim() && add(url.trim())}
          />
          <View className="flex-row gap-3">
            <NouButton variant="outline" onPress={() => activePageUrl && add(activePageUrl)}>
              {t('guri.allowAddCurrent', 'Add current page')}
            </NouButton>
            <NouButton disabled={!url.trim()} onPress={() => add(url.trim())}>
              {t('buttons.add', 'Add')}
            </NouButton>
          </View>
        </View>
      )}
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

        <AllowListSection />

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
