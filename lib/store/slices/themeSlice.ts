import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ThemeState {
  isDarkMode: boolean;
  colorTheme: string;
  systemTheme: "light" | "dark" | "system";
}

const initialState: ThemeState = {
  isDarkMode: false,
  colorTheme: "green",
  systemTheme: "light",
};

export const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    toggleTheme: (state) => {
      state.isDarkMode = !state.isDarkMode;
      state.systemTheme = state.isDarkMode ? "dark" : "light";
    },
    setTheme: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload;
      state.systemTheme = action.payload ? "dark" : "light";
    },
    setSystemTheme: (
      state,
      action: PayloadAction<"light" | "dark" | "system">
    ) => {
      state.systemTheme = action.payload;
      if (action.payload !== "system") {
        state.isDarkMode = action.payload === "dark";
      }
    },
    setColorTheme: (state, action: PayloadAction<string>) => {
      state.colorTheme = action.payload;
    },
    resetTheme: (state) => {
      state.isDarkMode = false;
      state.colorTheme = "green";
      state.systemTheme = "light";
    },
  },
});

export const {
  toggleTheme,
  setTheme,
  setSystemTheme,
  setColorTheme,
  resetTheme,
} = themeSlice.actions;

export default themeSlice.reducer;
