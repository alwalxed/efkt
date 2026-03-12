import { useEffect } from "react";
export function UseSwitch(type: string) {
  useEffect(() => {
    switch (type) {
      case "ws":
        return () => ws.close();
      default:
        break;
    }
  }, [type]);
}
