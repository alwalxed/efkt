import { useEffect } from "react";
export function UseTemplate(id: string) {
  useEffect(() => { doWork(); }, [`key-${id}`]);
}
