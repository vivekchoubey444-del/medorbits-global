import { Text, View } from "react-native";

export default function SettingsScreen() {
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700" }}>Settings</Text>
      <Text>Language, notification preferences, privacy information, and account actions belong here when implemented.</Text>
    </View>
  );
}
