import { useEffect } from "react";
export function UseLoop(items: string[]) {
  useEffect(() => {
    for (const item of items) {
      if (item === "special") return () => cleanup();
    }
  }, [items]);
}
