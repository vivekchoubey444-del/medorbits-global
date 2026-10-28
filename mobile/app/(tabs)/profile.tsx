import { Text, View } from "react-native";

export default function Screen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "700" }}>Profile</Text>
      <Text>Sign in to access profile features when authentication is implemented.</Text>
    </View>
  );
}
