import { useEffect } from "react";
export function Comp(a: string, b: string, c: string) {
  useEffect(() => { first(); }, [a]);
  useEffect(() => { second(); }, [b]);
  useEffect(() => { third(); }, [c]);
}
