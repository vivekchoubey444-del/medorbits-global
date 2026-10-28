import { Text, View } from "react-native";

export default function RegisterScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>Create account</Text>
      <Text>Registration is not connected. Implement server-side validation, consent, and abuse controls before enabling it.</Text>
    </View>
  );
}
