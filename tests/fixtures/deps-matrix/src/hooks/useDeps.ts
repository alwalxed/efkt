import { useEffect } from "react";

export function UseDeps(a: any, b: any) {
  useEffect(() => {}, [a, b]);
  useEffect(() => {}, []);
  useEffect(() => {}, [a.b, fn()]);
  useEffect(() => {}, undefined as any);
  useEffect(() => {});
}
