import { Link, Stack } from "expo-router";
import { Text, View } from "react-native";

export default function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Stack.Screen options={{ title: "Page not found" }} />
      <Text accessibilityRole="header" style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Page not found
      </Text>
      <Text style={{ marginBottom: 16 }}>The requested MedOrbits screen does not exist.</Text>
      <Link href="/">Return to home</Link>
    </View>
  );
}
