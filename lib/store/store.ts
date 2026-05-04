import { configureStore } from "@reduxjs/toolkit";
import themeReducer from "./slices/themeSlice";
import headerReducer from "./slices/headerSlice";

export const store = configureStore({
  reducer: {
    theme: themeReducer,
    header: headerReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
