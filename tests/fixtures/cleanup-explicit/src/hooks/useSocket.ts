import { useEffect } from "react";
export function UseSocket(url: string) {
  useEffect(() => {
    const s = connect(url);
    return () => s.close();
  }, [url]);
}
