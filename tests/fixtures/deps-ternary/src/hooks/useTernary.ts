import { useEffect } from "react";
export function UseTernary(cond: boolean, a: string, b: string) {
  useEffect(() => { doWork(); }, [cond ? a : b]);
}
