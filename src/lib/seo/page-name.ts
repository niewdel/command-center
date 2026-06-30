// Turn a URL path into a readable page name a client can scan, the way the
// homepage already reads as "Home". Shared by the web report and the email
// so both render the same professional labels.
//
//   "/"                          -> "Home"
//   "/services"                  -> "Services"
//   "/services/detail-packages"  -> "Detail Packages"
//   "/contact.html"              -> "Contact"
//
// Pure + dependency-free so it's safe in client components and server email.
export function humanizePath(path: string): string {
  let p = (path || "").trim();
  p = p.replace(/^https?:\/\/[^/]+/i, ""); // drop domain if present
  p = p.split("?")[0].split("#")[0].replace(/\/+$/, ""); // drop query/hash/trailing slash
  if (p === "" || p === "/" || p.toLowerCase() === "home") return "Home";
  const seg = p.split("/").filter(Boolean).pop() ?? "";
  const cleaned = seg
    .replace(/\.(html?|php|aspx?)$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();
  if (!cleaned) return "Home";
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
}
