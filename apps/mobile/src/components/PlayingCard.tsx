import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import type { VisibleCard as Card } from '@gadha-chor/shared-types';
import { palette } from './Screen';

export const RANK_LABELS: Record<Card['rank'], string> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};

export const SUIT_SYMBOLS: Record<Card['suit'], string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

type PipPosition = { readonly x: number; readonly y: number; readonly rotated?: boolean };

// Each entry lists how many pips sit in each row, top to bottom (1 = centered, 2 = a left/right
// pair). Rows are spread evenly between y=14 and y=86 so dense layouts (9, 10) never crowd
// together, and any row below the card's midpoint is flipped to read upright from that side.
const PIP_ROW_STRUCTURES: Record<number, readonly number[]> = {
  2: [1, 1],
  3: [1, 1, 1],
  4: [2, 2],
  5: [2, 1, 2],
  6: [2, 2, 2],
  7: [2, 1, 2, 2],
  8: [2, 1, 2, 1, 2],
  9: [2, 2, 1, 2, 2],
  10: [2, 1, 2, 2, 1, 2],
};

function buildPipLayout(rowCounts: readonly number[]): readonly PipPosition[] {
  const positions: PipPosition[] = [];
  rowCounts.forEach((columns, rowIndex) => {
    const y = rowCounts.length === 1 ? 50 : 20 + (rowIndex * 60) / (rowCounts.length - 1);
    const rotated = y > 52;
    if (columns === 1) {
      positions.push({ x: 50, y, rotated });
    } else {
      positions.push({ x: 34, y, rotated }, { x: 66, y, rotated });
    }
  });
  return positions;
}

const PIP_LAYOUTS: Record<number, readonly PipPosition[]> = Object.fromEntries(
  Object.entries(PIP_ROW_STRUCTURES).map(([rank, rows]) => [Number(rank), buildPipLayout(rows)]),
);

type CardSize = 'hand' | 'played' | 'mini';

type SizeSpec = {
  readonly width: number;
  readonly height: number;
  readonly cornerFont: number;
  readonly pipFont: number;
  readonly centerFont: number;
};

const SIZE_SPECS: Record<CardSize, SizeSpec> = {
  hand: { width: 58, height: 92, cornerFont: 13, pipFont: 10, centerFont: 30 },
  played: { width: 52, height: 74, cornerFont: 11, pipFont: 8, centerFont: 24 },
  mini: { width: 30, height: 44, cornerFont: 8, pipFont: 6, centerFont: 14 },
};

type PlayingCardProps = {
  readonly card?: Card | undefined;
  readonly faceDown?: boolean;
  readonly size?: CardSize;
  readonly rotateDeg?: number;
  readonly style?: StyleProp<ViewStyle>;
};

export function PlayingCard({
  card,
  faceDown = false,
  size = 'played',
  rotateDeg = 0,
  style,
}: PlayingCardProps): React.JSX.Element {
  const spec = SIZE_SPECS[size];
  const rotation = rotateDeg !== 0 ? [{ rotate: `${rotateDeg}deg` }] : undefined;

  if (faceDown || card === undefined) {
    return (
      <View
        style={[
          styles.card,
          styles.cardBack,
          { width: spec.width, height: spec.height },
          rotation !== undefined && { transform: rotation },
          style,
        ]}
      >
        <View style={styles.cardBackInner} />
      </View>
    );
  }

  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const rankLabel = RANK_LABELS[card.rank];
  const suitGlyph = SUIT_SYMBOLS[card.suit];
  const isFaceCard = card.rank >= 11 && card.rank <= 13;
  const isAce = card.rank === 14;
  const textColor = isRed ? palette.red : palette.ink;
  const cornerFontSize = rankLabel.length > 1 ? spec.cornerFont * 0.78 : spec.cornerFont;

  return (
    <View
      style={[
        styles.card,
        { width: spec.width, height: spec.height },
        rotation !== undefined && { transform: rotation },
        style,
      ]}
    >
      <View style={styles.cornerTopLeft}>
        <Text style={[styles.cornerRank, { color: textColor, fontSize: cornerFontSize }]}>
          {rankLabel}
        </Text>
        <Text style={[styles.cornerSuit, { color: textColor, fontSize: cornerFontSize }]}>
          {suitGlyph}
        </Text>
      </View>
      <View style={styles.cornerBottomRight}>
        <Text style={[styles.cornerRank, { color: textColor, fontSize: cornerFontSize }]}>
          {rankLabel}
        </Text>
        <Text style={[styles.cornerSuit, { color: textColor, fontSize: cornerFontSize }]}>
          {suitGlyph}
        </Text>
      </View>
      <View style={styles.center}>
        {isAce && <Text style={{ color: textColor, fontSize: spec.centerFont }}>{suitGlyph}</Text>}
        {isFaceCard && (
          <View style={[styles.faceFrame, { borderColor: textColor }]}>
            <Text style={[styles.faceLetter, { color: textColor }]}>{rankLabel}</Text>
            <Text style={{ color: textColor, fontSize: spec.pipFont + 4 }}>{suitGlyph}</Text>
          </View>
        )}
        {!isAce &&
          !isFaceCard &&
          (PIP_LAYOUTS[card.rank] ?? []).map((pip, index) => (
            <Text
              key={index}
              style={[
                styles.pip,
                {
                  color: textColor,
                  fontSize: spec.pipFont,
                  lineHeight: spec.pipFont,
                  left: (pip.x / 100) * spec.width - spec.pipFont / 2,
                  top: (pip.y / 100) * spec.height - spec.pipFont / 2,
                },
                pip.rotated === true && styles.pipRotated,
              ]}
            >
              {suitGlyph}
            </Text>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 8,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardBack: {
    backgroundColor: '#8A2432',
    borderColor: '#5E1620',
  },
  cardBackInner: {
    borderColor: '#C97C86',
    borderRadius: 4,
    borderWidth: 1,
    flex: 1,
    margin: 4,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  cornerBottomRight: {
    alignItems: 'center',
    bottom: 2,
    position: 'absolute',
    right: 3,
    transform: [{ rotate: '180deg' }],
  },
  cornerRank: {
    fontWeight: '800',
  },
  cornerSuit: {
    marginTop: -2,
  },
  cornerTopLeft: {
    alignItems: 'center',
    left: 3,
    position: 'absolute',
    top: 2,
  },
  faceFrame: {
    alignItems: 'center',
    borderRadius: 4,
    borderWidth: 1.5,
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  faceLetter: {
    fontSize: 20,
    fontWeight: '900',
  },
  pip: {
    position: 'absolute',
  },
  pipRotated: {
    transform: [{ rotate: '180deg' }],
  },
});
