import { useEffect } from "react";

export function MyComp(id: string) {
  // Fetch on mount
  useEffect(() => {
    /* block comment */
    fetchData(id); // inline comment
  }, [id]);

  useEffect(() => {
    console.log("no deps");
  });
}
