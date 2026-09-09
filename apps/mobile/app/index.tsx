import { Image, StyleSheet, Text, View } from 'react-native';
import { Screen, palette } from '../src/components/Screen';

import { PrimaryButton } from '../src/components/PrimaryButton';
import { useRouter } from 'expo-router';

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>DELHI • NORTH INDIA</Text>
        <Text style={styles.title}>{'GADHA\nCHOR'}</Text>
        <Text style={styles.subtitle}>Lose your cards. Keep your dignity.</Text>
      </View>

      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- static image asset
        source={require('../assets/gadha-hero.jpg')}
        resizeMode="cover"
        style={styles.heroImage}
      />

      <View style={styles.actions}>
        <PrimaryButton label="Create a room" onPress={() => router.push('/room/create')} />
        <PrimaryButton
          label="Join with a code"
          onPress={() => router.push('/room/join')}
          variant="secondary"
        />
      </View>

      <Text style={styles.footer}>A fast local card game for 3–6 friends.</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  footer: {
    color: palette.muted,
    fontSize: 13,
    marginBottom: 18,
    marginTop: 20,
    textAlign: 'center',
  },
  header: {
    marginTop: 12,
  },
  heroImage: {
    alignSelf: 'center',
    borderRadius: 20,
    height: 220,
    marginTop: 32,
    width: 220,
  },
  kicker: {
    color: palette.red,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  subtitle: {
    color: palette.muted,
    fontSize: 16,
    marginTop: 10,
  },
  title: {
    color: palette.ink,
    fontSize: 52,
    fontWeight: '900',
    lineHeight: 49,
    marginTop: 10,
  },
});
