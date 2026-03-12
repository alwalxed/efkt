import { useEffect } from "react";
export function Comp() {
  useEffect(() => {
    fetch("https://api.example.com");
  }, []);
}
