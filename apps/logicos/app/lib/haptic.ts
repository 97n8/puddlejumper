// Haptic feedback helper
export type HapticKind = 'tick' | 'soft' | 'success' | 'warn';

export function haptic(kind: HapticKind = 'tick'): void {
  try {
    if (!navigator.vibrate) return;

    const patterns: Record<HapticKind, number | number[]> = {
      tick: 8,
      soft: 12,
      success: [10, 30, 10],
      warn: [20, 40, 20]
    };

    navigator.vibrate(patterns[kind]);
  } catch (e) {
    // Silently fail
  }
}
