import { useEffect } from "react";

export function A() {
  useEffect(() => { return () => {}; }, []);
}
export function B() {
  useEffect(() => { return () => {}; }, []);
}
export function C() {
  useEffect(() => { return () => {}; }, []);
}
export function D() {
  useEffect(() => { fetchData(); }, [id]);
}
