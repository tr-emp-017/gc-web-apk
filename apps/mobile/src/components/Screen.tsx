import type { PropsWithChildren } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

type ScreenProps = PropsWithChildren<{ readonly scroll?: boolean }>;

export function Screen({ children, scroll = false }: ScreenProps): React.JSX.Element {
  if (scroll) {
    return (
      <ScrollView contentContainerStyle={styles.screen} style={styles.scrollContainer}>
        {children}
      </ScrollView>
    );
  }
  return <View style={styles.screen}>{children}</View>;
}

export const palette = {
  ink: '#17212B',
  muted: '#66727D',
  paper: '#F6F2E9',
  red: '#C94B3C',
  saffron: '#E5A33A',
  white: '#FFFFFF',
};

export const styles = StyleSheet.create({
  screen: {
    backgroundColor: palette.paper,
    flexGrow: 1,
    paddingBottom: 32,
    paddingHorizontal: 24,
    paddingTop: 56,
    position: 'relative',
  },
  scrollContainer: {
    backgroundColor: palette.paper,
    flex: 1,
  },
});
