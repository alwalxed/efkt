import { useEffect } from "react";
export function UseHole(a: string) {
  // @ts-expect-error intentional sparse array for testing
  useEffect(() => { doWork(); }, [, a]);
}
