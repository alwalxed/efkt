import { useEffect } from "react";

export function UseWeird() {
  useEffect(function () {}, []);
  // @ts-expect-error intentionally malformed call
  useEffect();
}
