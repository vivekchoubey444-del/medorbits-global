import { Text, View } from "react-native";

export default function ForgotPasswordScreen() {
  return (
    <View style={{ flex: 1, padding: 24, justifyContent: "center", gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontSize: 28, fontWeight: "700" }}>Reset password</Text>
      <Text>Connect to the backend's verified account-recovery flow. Do not disclose whether an email or phone number exists.</Text>
    </View>
  );
}
