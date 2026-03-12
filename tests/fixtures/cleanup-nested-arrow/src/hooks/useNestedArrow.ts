import { useEffect } from "react";
export function UseNestedArrow() {
  useEffect(() => {
    const inner = () => {
      return () => cleanup();
    };
    inner();
  }, []);
}
