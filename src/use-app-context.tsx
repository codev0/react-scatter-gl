import { useContext } from "react";
import { AppContext } from "./app-provider";

export const useAppContext = () => {
  const ctx = useContext(AppContext);
  if (ctx === undefined) {
    throw new Error("useTodoContext must be within TodoProvider");
  }
  return ctx;
};
