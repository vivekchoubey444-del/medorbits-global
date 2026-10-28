import { Text, View } from "react-native";

export default function Screen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "700" }}>Careers</Text>
      <Text>Explore career guidance and verified opportunities.</Text>
    </View>
  );
}
