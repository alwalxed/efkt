import { useEffect } from "react";
export function Comp() {
  useEffect(() => {
    fetchData();
    setLoaded(true);
  }, []);
}
