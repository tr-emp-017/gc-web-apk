import { ScrollView, StyleSheet, View } from 'react-native';

import type { PropsWithChildren } from 'react';

type ScreenProps = PropsWithChildren<{ readonly scroll?: boolean }>;

export function Screen({ children, scroll = false }: ScreenProps): React.JSX.Element {
  if (scroll) {
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.container}>
        {children}
      </ScrollView>
    );
  }
  return (
    <View style={styles.container}>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

export const palette = {
  ink: '#17212B',
  muted: '#66727D',
  paper: '#F6F2E9',
  red: '#C94B3C',
  saffron: '#E5A33A',
  white: '#FFFFFF',
};

// A full-bleed paper-colored backdrop (so a wide desktop web window never shows blank space
// beside the content) with the actual content capped to a phone-like width and centered — on
// native/mobile-width screens `maxWidth` never engages, so nothing changes there. This is what
// keeps a row like "avatar — name — action button" from spreading a button far from its label
// on a wide browser window instead of sitting naturally next to it. Note: game.tsx's own table
// view doesn't use Screen at all (it manages its own full-window, onLayout-measured root), so
// this cap only ever affects the simpler list/form screens.
const styles = StyleSheet.create({
  container: {
    backgroundColor: palette.paper,
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    flexGrow: 1,
    maxWidth: 480,
    paddingBottom: 40,
    paddingHorizontal: 24,
    paddingTop: 30,
    position: 'relative',
    width: '100%',
  },
});
