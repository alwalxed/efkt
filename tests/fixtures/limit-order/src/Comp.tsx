import { useEffect } from "react";
export function Comp(a: string) {
  useEffect(() => { untrackedWork(); });
  useEffect(() => { reactiveWork(); }, [a]);
  useEffect(() => { onceWork(); }, []);
}
