import { useEffect } from "./myCustomHooks";
export function MyComp() {
  useEffect(() => { doThing(); }, []);
}
