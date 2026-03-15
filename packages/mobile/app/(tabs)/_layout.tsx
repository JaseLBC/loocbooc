import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';

interface TabIconProps {
  emoji: string;
  label: string;
  focused: boolean;
}

function TabIcon({ emoji, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabIcon}>
      <Text style={[styles.emoji, focused && styles.emojiFocused]}>{emoji}</Text>
      <Text style={[styles.label, focused && styles.labelFocused]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="⌂" label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan Garment',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="📸" label="Scan" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="label"
        options={{
          title: 'Scan Label',
          tabBarIcon: ({ focused }) => (
            <TabIcon emoji="🏷️" label="Label" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#111111',
    borderTopColor: '#1A1A1A',
    borderTopWidth: 1,
    height: 80,
    paddingBottom: 12,
  },
  tabIcon: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 6,
  },
  emoji: {
    fontSize: 22,
    opacity: 0.4,
  },
  emojiFocused: {
    opacity: 1,
  },
  label: {
    fontSize: 10,
    color: '#4B5563',
    fontWeight: '500',
  },
  labelFocused: {
    color: '#FFFFFF',
  },
});
