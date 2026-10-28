import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="admissions" options={{ title: "Admissions" }} />
      <Tabs.Screen name="colleges" options={{ title: "Colleges" }} />
      <Tabs.Screen name="careers" options={{ title: "Careers" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
