import { useEffect } from "react";
export function UseExpr(id: string) {
  useEffect(() => void fetchData(id), [id]);
}
