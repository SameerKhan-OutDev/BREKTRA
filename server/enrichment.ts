import { lookup, resolveMx } from "node:dns/promises";
import { request } from "node:https";
import { isIP } from "node:net";
import type { Enrichment } from "../shared/outreach.ts";
import { id, now } from "./domain.ts";

// IPv6 is conservatively excluded from fetching in this first public-page
// adapter. That also excludes mapped IPv4, link-local and metadata endpoints.
export function publicIPv4(address: string) {
  if (isIP(address) !== 4) return false;
  const [a, b] = address.split(".").map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && [0, 168].includes(b)) ||
    (a === 198 && [18, 19, 51].includes(b)) || (a === 203 && b === 0));
}
export function checkedUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") ||
      url.hostname === "localhost" || /(^|\.)(linkedin\.com|googleapis\.com)$/.test(url.hostname))
    throw new Error("Use a public HTTPS company website, without credentials or a custom port. LinkedIn profile enrichment requires its separate account adapter.");
  url.hash = "";
  return url;
}
async function publicPage(value: string, redirects = 0): Promise<{ url: string; html: string }> {
  const url = checkedUrl(value);
  const addresses = await lookup(url.hostname, { all: true, family: 4 });
  if (!addresses.length || addresses.some((a) => !publicIPv4(a.address))) throw new Error("Private, reserved and local network websites cannot be enriched.");
  const pinned = addresses[0].address;
  return new Promise((resolve, reject) => {
    // Pin the validated address for the TLS request; do not resolve it a second
    // time during connection (DNS rebinding). Certificate verification stays on.
    const req = request(url, { headers: { "User-Agent": "BREKTRA-CompanyEvidence/1.0", Accept: "text/html", "Accept-Encoding": "identity" },
      lookup: (_hostname, _options, callback) => callback(null, pinned, 4),
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode || 0) && res.headers.location) {
        res.resume();
        if (redirects >= 3) { reject(new Error("The company website redirected too many times.")); return; }
        publicPage(new URL(res.headers.location, url).href, redirects + 1).then(resolve, reject);
        return;
      }
      if (res.statusCode !== 200 || !String(res.headers["content-type"] || "").includes("text/html")) {
        res.resume(); reject(new Error("The website did not return a readable HTML company page.")); return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > 512000) { res.destroy(); req.destroy(new Error("The page exceeds the 500 KB evidence limit.")); }
        else chunks.push(chunk);
      });
      res.once("error", () => reject(new Error("The company page could not be read completely.")));
      res.once("end", () => resolve({ url: url.href, html: Buffer.concat(chunks).toString("utf8") }));
    });
    req.setTimeout(12000, () => req.destroy(new Error("The company website timed out.")));
    req.once("error", () => reject(new Error("Unable to securely read the company website.")));
    req.end();
  });
}
const clean = (value: string) => value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
  .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ")
  .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
export function extractEvidence(html: string) {
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<!--[\s\S]*?-->/g, " ");
  const title = clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "").slice(0, 500);
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  const description = tags.find((tag) => /(?:name|property)\s*=\s*["'](?:description|og:description)["']/i.test(tag));
  const summary = clean(description?.match(/content\s*=\s*(["'])([\s\S]*?)\1/i)?.[2] || "").slice(0, 3000);
  const listedEmails = [...new Set((html.match(/href\s*=\s*["']mailto:([^\s"'<>?]+)/gi) || []).map((v) =>
    v.replace(/^.*mailto:/i, "").toLowerCase()).filter((v) => /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}$/i.test(v)))].slice(0, 20);
  return { title, summary, listedEmails };
}
export async function enrichCompany(leadId: string, website: string, email = "",
  page = publicPage, mx: typeof resolveMx = resolveMx): Promise<Enrichment> {
  const result = await page(checkedUrl(website).href);
  let emailDomainStatus: Enrichment["emailDomainStatus"] = "not_checked";
  if (email) {
    try { emailDomainStatus = (await mx(email.split("@")[1])).some((r) => r.exchange && r.exchange !== ".") ? "has_mx" : "no_mx"; }
    catch { emailDomainStatus = "not_checked"; }
  }
  return { id: id(), leadId, sourceUrl: result.url, checkedAt: now(), ...extractEvidence(result.html), emailDomainStatus, status: "pending" };
}
