import { useEffect } from 'react';

export function UseCleanup(url: string) {
  useEffect(() => {
    const socket = connect(url);
    return () => socket.close();
  }, [url]);

  useEffect(() => {
    console.log('no cleanup');
  }, []);
}
