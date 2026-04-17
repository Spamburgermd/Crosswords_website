/**
 * src/components/GuessBar.tsx
 * ---------------------------------------------
 * Text input + submit button combo used for guessing words. In Step 2 we read theme
 * colors from the UI store so the control matches whichever palette the player picks.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import useUIStore from '@stores/uiStore';

export type GuessBarProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSubmitGuess: () => void;
  disabled?: boolean;
};

export default function GuessBar({
  value,
  onChangeText,
  onSubmitGuess,
  disabled = false,
}: GuessBarProps): React.JSX.Element {
  const theme = useUIStore((state) => state.activeTheme);
  const trimmedValue = value.trim();

  const isSubmitDisabled = disabled || trimmedValue.length === 0;

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: theme.inputBackground,
            borderColor: theme.inputBorder,
            color: theme.textPrimary,
          },
          disabled && styles.disabledInput,
        ]}
        placeholder="Type your guess"
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel="Guess input"
        value={value}
        onChangeText={onChangeText}
        editable={!disabled}
      />
      <Pressable
        onPress={onSubmitGuess}
        accessibilityRole="button"
        accessibilityLabel="Submit guess"
        disabled={isSubmitDisabled}
        style={({ pressed }) => [
          styles.submitButton,
          {
            backgroundColor: isSubmitDisabled ? theme.accentMuted : theme.accent,
          },
          pressed && !isSubmitDisabled && styles.submitButtonPressed,
        ]}
      >
        <Text style={[styles.submitButtonText, { color: theme.accentText }]}>Submit</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  disabledInput: {
    opacity: 0.6,
  },
  submitButton: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
  },
  submitButtonPressed: {
    opacity: 0.8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});

