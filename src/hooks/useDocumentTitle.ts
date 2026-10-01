import { useEffect } from "react";

export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · My Finance` : "My Finance";
  }, [title]);
}
