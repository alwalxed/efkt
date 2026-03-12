import { useEffect } from "react";
export function App({ id }: { id: string }) {
  useEffect(() => { fetchData(id); }, [id]);
  useEffect(() => { document.title = "App"; }, []);
  useEffect(() => { console.log("mount"); });
}
