import React, { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * RNF009 - Feedback visual (toast/snackbar) para as ações do usuário.
 *
 * Implementação própria (sem dependência nativa) baseada em Animated,
 * compatível com Android, iOS e Web. Mostra um toast por vez com
 * auto-dismiss e fila simples.
 */

export type ToastType = 'success' | 'error' | 'info';

interface ToastConfig {
  message: string;
  type: ToastType;
}

interface ToastContextProps {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextProps | undefined>(undefined);

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: 'checkmark-circle',
  error: 'alert-circle',
  info: 'information-circle',
};

const ACCENTS: Record<ToastType, string> = {
  success: '#34C759',
  error: '#CC0000',
  info: '#007AFF',
};

const DURATION = 2600;

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastConfig | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(20)).current;
  const hideTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(translateY, { toValue: 20, duration: 200, useNativeDriver: Platform.OS !== 'web' }),
    ]).start(() => setToast(null));
  }, [opacity, translateY]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    setToast({ message, type });
    opacity.setValue(0);
    translateY.setValue(20);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(translateY, { toValue: 0, bounciness: 6, useNativeDriver: Platform.OS !== 'web' }),
    ]).start();
    hideTimeout.current = setTimeout(hide, DURATION);
  }, [opacity, translateY, hide]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <View pointerEvents="box-none" style={[styles.overlay, { bottom: Math.max(insets.bottom, 16) + 16 }]}>
          <Animated.View style={[styles.toast, { borderLeftColor: ACCENTS[toast.type], opacity, transform: [{ translateY }] }]}>
            <Ionicons name={ICONS[toast.type]} size={22} color={ACCENTS[toast.type]} />
            <Text style={styles.toastText} numberOfLines={2}>{toast.message}</Text>
          </Animated.View>
        </View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast deve ser usado dentro de um ToastProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    maxWidth: 420,
    width: '88%',
    backgroundColor: '#1a1f2e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2a324a',
    borderLeftWidth: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.4)',
    elevation: 8,
  },
  toastText: {
    flex: 1,
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
