import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { getSession } from '../data/session';

/**
 * RF004 - Ao carregar o app, verifica se há sessão salva:
 * redireciona para T-04 (pós-login) se válida, ou T-01 (apresentação) se não.
 */
export default function Index() {
  const [target, setTarget] = useState<'/04poslogin' | '/01apresentacao' | null>(null);

  useEffect(() => {
    getSession().then((session) => {
      setTarget(session ? '/04poslogin' : '/01apresentacao');
    });
  }, []);

  if (!target) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0e1a', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color="#007AFF" />
      </View>
    );
  }

  return <Redirect href={target} />;
}
