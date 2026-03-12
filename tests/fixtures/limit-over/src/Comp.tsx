import { useEffect } from "react";
export function Comp(a: string, b: string) {
  useEffect(() => { first(); }, [a]);
  useEffect(() => { second(); }, [b]);
}
