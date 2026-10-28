import { Link } from "expo-router";
import { Text, View } from "react-native";

export default function LoginScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>Sign in</Text>
      <Text>Connect this screen to the verified MedOrbits authentication API before use.</Text>
      <Link href="/(tabs)">Continue to public information</Link>
    </View>
  );
}
