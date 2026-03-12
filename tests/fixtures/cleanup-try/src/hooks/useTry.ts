import { useEffect } from "react";
export function UseTry() {
  useEffect(() => {
    try {
      return () => teardown();
    } catch (e) {
      console.error(e);
    }
  }, []);
}
