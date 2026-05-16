// Weather adjustment sheet for StyleMeScreen — extracted in Phase 3.
//
// Modal/sheet UI that lets the user override the auto-detected weather
// before kicking a generation. The modal's open/closed state lives in
// the orchestrator (per Phase 3 modularization risk #1 — lift modal
// state to the parent and pass `isOpen` + `onClose` down). All the
// "current value" math (stepper temperature, condition chip selection)
// is computed from the props that come in, so the sheet itself remains
// stateless.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTokens } from '../../theme/ThemeProvider';
import { fonts, radii } from '../../theme/tokens';
import { Chip } from '../../components/Chip';
import { Eyebrow } from '../../components/Eyebrow';
import { PageTitle } from '../../components/PageTitle';
import type { ManualWeatherInput } from '../../hooks/useWeather';
import { hapticLight } from '../../lib/haptics';
import { t as tr } from '../../lib/i18n';

type WeatherCondition = ManualWeatherInput['condition'];
const CONDITIONS: WeatherCondition[] = ['clear', 'cloudy', 'rain', 'snow'];

export interface StyleMeWeatherSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Live weather temperature from `useWeather()`; used as the fallback
   *  base value when the user steps the temperature without first
   *  picking a condition. */
  baseTemperature: number | null | undefined;
  manualOverride: ManualWeatherInput | null;
  onApplyManualWeather: (next: ManualWeatherInput) => void;
  onResetWeather: () => void;
}

export function StyleMeWeatherSheet({
  isOpen,
  onClose,
  baseTemperature,
  manualOverride,
  onApplyManualWeather,
  onResetWeather,
}: StyleMeWeatherSheetProps) {
  const t = useTokens();
  // Helper closures resolve the current stepper baseline. Pulling these
  // inline avoided a `useCallback` per render in the original file, which
  // we keep here for parity — the sheet only ticks during interaction.
  const currentTemp = manualOverride?.tempC ?? baseTemperature ?? 14;
  const currentCondition = manualOverride?.condition ?? 'clear';
  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      transparent
      onRequestClose={onClose}>
      <View style={s.modalBackdrop}>
        <View style={[s.modalSheet, { backgroundColor: t.bg, borderColor: t.border }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <PageTitle size={20}>{tr('styleMe.weather.adjustTitle')}</PageTitle>
            <Pressable onPress={onClose} accessibilityRole="button">
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 14, color: t.accent }}>
                {tr('styleMe.weather.adjust.done')}
              </Text>
            </Pressable>
          </View>

          <Eyebrow>{tr('styleMe.weather.tempLabel')}</Eyebrow>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 18 }}>
            <Pressable
              onPress={() => {
                hapticLight();
                onApplyManualWeather({
                  tempC: currentTemp - 1,
                  condition: currentCondition,
                });
              }}
              style={[s.stepperBtn, { borderColor: t.border, backgroundColor: t.card }]}
              accessibilityRole="button"
              accessibilityLabel="Decrease temperature">
              <Text style={{ fontFamily: fonts.uiSemi, fontSize: 18, color: t.fg }}>−</Text>
            </Pressable>
            <Text style={{ fontFamily: fonts.uiSemi, fontSize: 22, color: t.fg, minWidth: 60, textAlign: 'center' }}>
              {currentTemp}°
            </Text>
            <Pressable
              onPress={() => {
                hapticLight();
                onApplyManualWeather({
                  tempC: currentTemp + 1,
                  condition: currentCondition,
                });
              }}
              style={[s.stepperBtn, { borderColor: t.border, backgroundColor: t.card }]}
              accessibilityRole="button"
              accessibilityLabel="Increase temperature">
              <Text style={{ fontFamily: fonts.uiSemi, fontSize: 18, color: t.fg }}>+</Text>
            </Pressable>
          </View>

          <Eyebrow>{tr('styleMe.weather.conditionLabel')}</Eyebrow>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {CONDITIONS.map((cond) => {
              const active = currentCondition === cond;
              return (
                <Chip
                  key={cond}
                  label={tr(`styleMe.weather.condition.${cond}`)}
                  active={active}
                  onPress={() => {
                    hapticLight();
                    onApplyManualWeather({
                      tempC: currentTemp,
                      condition: cond,
                    });
                  }}
                />
              );
            })}
          </View>

          {manualOverride ? (
            <Pressable
              onPress={() => {
                hapticLight();
                onResetWeather();
              }}
              accessibilityRole="button"
              style={{ marginTop: 18, alignSelf: 'flex-start' }}>
              <Text style={{ fontFamily: fonts.uiMed, fontSize: 13, color: t.accent }}>
                {tr('styleMe.weather.adjust.reset')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    paddingHorizontal: 20,
    paddingVertical: 22,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
