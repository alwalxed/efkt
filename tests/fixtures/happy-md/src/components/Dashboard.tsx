import { useEffect } from "react";

const Dashboard = () => {
  useEffect(() => {
    document.title = "Dashboard";
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => console.log(e.key);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  return <div>Dashboard</div>;
};

export default Dashboard;
