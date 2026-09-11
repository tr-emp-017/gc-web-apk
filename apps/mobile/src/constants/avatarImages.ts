import type { AvatarId } from '@gadha-chor/shared-types';
import type { ImageSourcePropType } from 'react-native';

// Illustrated avatar art lives only here (mobile-only asset), keyed by the platform-agnostic
// AvatarId ids defined in shared-types.
/* eslint-disable @typescript-eslint/no-require-imports -- static asset requires */
export const AVATAR_IMAGES: Record<AvatarId, ImageSourcePropType> = {
  'beard-glasses': require('../../assets/avatars/beard-glasses.png'),
  'big-laugh': require('../../assets/avatars/big-laugh.png'),
  'cool-hoodie': require('../../assets/avatars/cool-hoodie.png'),
  donkey: require('../../assets/avatars/donkey.png'),
  'dreamy-hands': require('../../assets/avatars/dreamy-hands.png'),
  'game-on-cap': require('../../assets/avatars/game-on-cap.png'),
  headphones: require('../../assets/avatars/headphones.png'),
  'peace-sign': require('../../assets/avatars/peace-sign.png'),
  'thinking-glasses': require('../../assets/avatars/thinking-glasses.png'),
  'wink-tongue': require('../../assets/avatars/wink-tongue.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */
