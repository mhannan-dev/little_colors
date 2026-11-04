export const COLORS = ['red', 'yellow', 'blue', 'orange', 'green', 'purple'] as const;
export type Color = (typeof COLORS)[number];

export type Difficulty = 'beginner' | 'explorer' | 'advanced';
export type Locale = 'bn-BD' | 'en-US';
export type GameMode = 'mixing' | 'matching' | 'numbers';
