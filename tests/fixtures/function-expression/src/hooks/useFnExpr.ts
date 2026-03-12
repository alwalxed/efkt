import { useEffect } from "react";

export function UseFnExpr() {
  useEffect(function () {
    console.log("hello");
  }, []);
}
