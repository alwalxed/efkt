import { useEffect } from "react";
export function UseCatch() {
  useEffect(() => {
    try {
      setup();
    } catch (e) {
      return () => teardown();
    }
  }, []);
}
