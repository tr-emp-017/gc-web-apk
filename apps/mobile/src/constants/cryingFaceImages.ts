import type { AvatarId } from '@gadha-chor/shared-types';
import type { ImageSourcePropType } from 'react-native';

// The game-over screen shows the Gadha Chor's own avatar crying instead of their normal happy
// portrait. Sliced from a matching crying-variant sprite sheet, keyed by the same AvatarId used
// everywhere else — dreamy-hands has no direct crying match in that sheet, so it reuses
// wink-tongue's (closer than a mismatched male face would be).
/* eslint-disable @typescript-eslint/no-require-imports -- static asset requires */
export const CRYING_FACE_IMAGES: Record<AvatarId, ImageSourcePropType> = {
  'beard-glasses': require('../../assets/game-over/beard-glasses.png'),
  'big-laugh': require('../../assets/game-over/big-laugh.png'),
  'cool-hoodie': require('../../assets/game-over/cool-hoodie.png'),
  donkey: require('../../assets/game-over/donkey.png'),
  'dreamy-hands': require('../../assets/game-over/wink-tongue.png'),
  'game-on-cap': require('../../assets/game-over/game-on-cap.png'),
  headphones: require('../../assets/game-over/headphones.png'),
  'peace-sign': require('../../assets/game-over/peace-sign.png'),
  'thinking-glasses': require('../../assets/game-over/thinking-glasses.png'),
  'wink-tongue': require('../../assets/game-over/wink-tongue.png'),
};
/* eslint-enable @typescript-eslint/no-require-imports */
