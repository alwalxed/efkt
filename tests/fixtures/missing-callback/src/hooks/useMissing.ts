import { useEffect } from "react";

export function UseMissing() {
  // @ts-expect-error intentionally malformed call
  useEffect();
}
