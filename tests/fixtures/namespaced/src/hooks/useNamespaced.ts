import * as React from "react";

export function UseNamespaced() {
  React.useEffect(() => {
    console.log("namespaced");
  }, []);
}
