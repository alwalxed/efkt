import { useEffect } from 'react';

export function UseWeird() {
  useEffect(() => {}, []);
  // @ts-expect-error intentionally malformed call
  useEffect();
}
