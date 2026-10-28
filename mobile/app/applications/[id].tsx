import { useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";

export default function ApplicationDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <View style={{ flex: 1, padding: 24, gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "700" }}>Application details</Text>
      <Text>Application reference: {id ?? "Unavailable"}</Text>
      <Text>Fetch details only after the backend confirms the current user is authorized to view this application.</Text>
    </View>
  );
}
