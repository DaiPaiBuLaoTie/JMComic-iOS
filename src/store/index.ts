// store.ts
import { configureStore } from "@reduxjs/toolkit";
import rootFeature from "./rootFeature";
import { ThunkDispatch } from "redux-thunk";
const store = configureStore({
  reducer: rootFeature
});

// 自動推斷 RootState 類型
export type RootState = ReturnType<typeof rootFeature>;
// 自定義 AppDispatch 類型
export type AppDispatch = ThunkDispatch<RootState, unknown, any>;
export default store;
