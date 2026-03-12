import { useEffect } from "react";
export function Comp() {
  useEffect(() => { untrackedWork(); });
  useEffect(() => { mountWork(); }, []);
}
