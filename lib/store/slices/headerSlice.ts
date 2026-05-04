import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface HeaderButtonConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export interface HeaderState {
  buttonsConfig: HeaderButtonConfig[];
  presets: Record<string, string[]>;
}

const defaultButtons: HeaderButtonConfig[] = [
  { id: "ai-assistant", name: "AI Assistant", enabled: true },
  { id: "quick-theme-toggle", name: "Quick Theme Toggle", enabled: true },
  { id: "theme-settings", name: "Theme Settings", enabled: false },
  { id: "header-settings", name: "Header Settings", enabled: true },
];

const defaultPresets = {
  minimal: ["ai-assistant", "header-settings"],
  standard: ["ai-assistant", "quick-theme-toggle", "header-settings"],
  full: [
    "ai-assistant",
    "quick-theme-toggle",
    "theme-settings",
    "header-settings",
  ],
  developer: [
    "ai-assistant",
    "quick-theme-toggle",
    "theme-settings",
    "header-settings",
  ],
};

const initialState: HeaderState = {
  buttonsConfig: defaultButtons,
  presets: defaultPresets,
};

export const headerSlice = createSlice({
  name: "header",
  initialState,
  reducers: {
    toggleButton: (state, action: PayloadAction<string>) => {
      const button = state.buttonsConfig.find((b) => b.id === action.payload);
      if (button) {
        button.enabled = !button.enabled;
      }
    },
    enableButton: (state, action: PayloadAction<string>) => {
      const button = state.buttonsConfig.find((b) => b.id === action.payload);
      if (button) {
        button.enabled = true;
      }
    },
    disableButton: (state, action: PayloadAction<string>) => {
      const button = state.buttonsConfig.find((b) => b.id === action.payload);
      if (button) {
        button.enabled = false;
      }
    },
    setButtonsFromList: (state, action: PayloadAction<string[]>) => {
      state.buttonsConfig.forEach((button) => {
        button.enabled = action.payload.includes(button.id);
      });
    },
    applyPreset: (
      state,
      action: PayloadAction<keyof typeof defaultPresets>
    ) => {
      const presetButtons =
        state.presets[action.payload] || defaultPresets[action.payload];
      state.buttonsConfig.forEach((button) => {
        button.enabled = presetButtons.includes(button.id);
      });
    },
    setButtonsConfig: (state, action: PayloadAction<HeaderButtonConfig[]>) => {
      state.buttonsConfig = action.payload;
    },
    resetHeader: (state) => {
      state.buttonsConfig = defaultButtons;
      state.presets = defaultPresets;
    },
  },
});

export const {
  toggleButton,
  enableButton,
  disableButton,
  setButtonsFromList,
  applyPreset,
  setButtonsConfig,
  resetHeader,
} = headerSlice.actions;

export default headerSlice.reducer;
