import { useEffect } from "react";
export function UseFinally() {
  useEffect(() => {
    try {
      setup();
    } finally {
      return () => teardown();
    }
  }, []);
}
