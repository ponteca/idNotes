import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ObterKey() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Obter Key</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
});
