import { Text, View } from "react-native";

export default function Screen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 26, fontWeight: "700" }}>Welcome to MedOrbits</Text>
      <Text>Explore education, admissions, careers, and student-support resources.</Text>
    </View>
  );
}
