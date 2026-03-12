import { useEffect } from "react";
export function UseBareReturn(ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    doSomething();
  }, [ready]);
}
