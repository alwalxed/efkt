import { useEffect } from "react";
export function UseNestedFn() {
  useEffect(() => {
    function inner() {
      return () => cleanup();
    }
    inner();
  }, []);
}
