import { useEffect, useState } from "react";

export function currentRoute(): string {
  const h = typeof location !== "undefined" ? location.hash.replace(/^#/, "") : "";
  return h || "/";
}

export function useRoute(): [string, (to: string) => void] {
  const [route, setRoute] = useState(currentRoute);
  useEffect(() => {
    const on = () => setRoute(currentRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return [route, (to) => (location.hash = to.startsWith("#") ? to : `#${to}`)];
}
