import { useEffect } from "react";
export function UseSpread(deps: string[]) {
  // @ts-expect-error spread in deps for testing
  useEffect(() => { doWork(); }, [...deps]);
}
