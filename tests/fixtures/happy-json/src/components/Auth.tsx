import { useEffect, useState } from "react";

export function AuthForm({ userId, token }: { userId: string; token: string }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUser(userId);
    setLoading(false);
  }, [userId, token]);

  return <div>{loading ? "Loading..." : "Done"}</div>;
}
