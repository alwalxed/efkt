import { useEffect } from "react";
export function Ordered(a: string, b: string, c: string) {
  useEffect(() => { first(); }, [a]);
  useEffect(() => { second(); }, [b]);
  useEffect(() => { third(); }, [c]);
}
