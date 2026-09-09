import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { Screen, palette } from '../src/components/Screen';

export default function HomeScreen(): React.JSX.Element {
  const router = useRouter();

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.kicker}>DELHI • NORTH INDIA</Text>
        <Text style={styles.title}>{'GADHA\nCHOR'}</Text>
        <Text style={styles.subtitle}>Lose your cards. Keep your dignity.</Text>
      </View>

      <View style={styles.cardMark}>
        <Text style={styles.cardSuit}>♠</Text>
        <Text style={styles.cardRank}>A</Text>
      </View>

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
  cardMark: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: palette.white,
    borderColor: '#DED8CC',
    borderRadius: 20,
    borderWidth: 1,
    height: 188,
    justifyContent: 'center',
    marginTop: 40,
    transform: [{ rotate: '-7deg' }],
    width: 132,
  },
  cardRank: {
    color: palette.ink,
    fontSize: 58,
    fontWeight: '800',
    lineHeight: 64,
  },
  cardSuit: {
    color: palette.red,
    fontSize: 42,
    lineHeight: 44,
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
