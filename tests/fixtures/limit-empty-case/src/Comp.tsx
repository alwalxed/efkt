import { useEffect } from "react";
export function Comp(a: string) {
  useEffect(() => { work(); }, [a]);
}
