import { useEffect } from "react";

const Dashboard = () => {
    useEffect(() => {
        document.title = "Dashboard";
        if (true) {
            console.log("nested");
        }
    }, []);

    return <div>Dashboard</div>;
};

export default Dashboard;
