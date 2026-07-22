import { Text, type TextProps } from 'react-native'
import { clsx } from '@/lib/utils'

// In React Native each weight is a separate font file, so map the Tailwind
// weight/mono classes to the matching loaded IBM Plex family (the brand fonts).
function brandFontFamily(className?: string): string {
  const cls = className || ''
  if (cls.includes('font-mono')) return 'IBMPlexMono_500Medium'
  if (cls.includes('font-bold')) return 'IBMPlexSans_700Bold'
  if (cls.includes('font-semibold')) return 'IBMPlexSans_600SemiBold'
  if (cls.includes('font-medium')) return 'IBMPlexSans_500Medium'
  return 'IBMPlexSans_400Regular'
}

export const NouText: React.FC<TextProps> = ({ className, style, ...rest }) => (
  <Text
    className={clsx('text-zinc-900 dark:text-gray-100', className)}
    style={[{ fontFamily: brandFontFamily(className) }, style]}
    {...rest}
  />
)
