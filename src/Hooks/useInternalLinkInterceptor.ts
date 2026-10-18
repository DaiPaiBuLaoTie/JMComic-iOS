import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

// 全域攔截 <a> 點擊，改走前端路由
const useInternalLinkInterceptor = () => {
  const navigate = useNavigate();
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as HTMLElement)?.closest("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href) return;

      // 有 payment? 一律導回站內 /pay，並保留原本的 query string
      if (href.includes("payment?")) {
        const query = href.split("payment?")[1] || "";
        event.preventDefault();
        navigate(query ? `/pay?${query}` : "/pay");
        return;
      }
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      if (!href.startsWith("/") || href.startsWith("//")) return;
      event.preventDefault();
      navigate(href);
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [navigate]);
};
export default useInternalLinkInterceptor;
