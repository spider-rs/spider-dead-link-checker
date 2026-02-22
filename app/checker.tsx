"use client";

import { useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";

interface LinkResult {
  url: string;
  status: number;
  sourcePage: string;
  ok: boolean;
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const href = match[1];
    if (href.startsWith("http://") || href.startsWith("https://")) {
      links.push(href);
    } else if (href.startsWith("/")) {
      try {
        const base = new URL(baseUrl);
        links.push(`${base.origin}${href}`);
      } catch {}
    }
  }
  return [...new Set(links)];
}

export default function Checker() {
  const [data, setData] = useState<any[] | null>(null);

  const pages = data || [];
  const allLinks: LinkResult[] = [];

  for (const page of pages) {
    if (!page?.url || !page?.content) continue;
    const found = extractLinks(page.content, page.url);
    for (const link of found) {
      const linkedPage = pages.find((p: any) => p.url === link);
      allLinks.push({
        url: link,
        status: linkedPage?.status || (linkedPage ? 200 : 0),
        sourcePage: page.url,
        ok: linkedPage ? (linkedPage.status || 200) < 400 : true,
      });
    }
  }

  const broken = allLinks.filter((l) => !l.ok);
  const redirects = allLinks.filter((l) => l.status >= 300 && l.status < 400);
  const okLinks = allLinks.filter((l) => l.ok && l.status < 300);

  return (
    <div className="flex flex-col h-screen">
      <SearchBar setDataValues={setData} />
      <div className="flex-1 overflow-auto p-4">
        {pages.length > 0 && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-6">
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{allLinks.length}</p>
                <p className="text-sm text-muted-foreground">Total Links</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-red-500">{broken.length}</p>
                <p className="text-sm text-muted-foreground">Broken</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-yellow-500">{redirects.length}</p>
                <p className="text-sm text-muted-foreground">Redirects</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold text-green-500">{okLinks.length}</p>
                <p className="text-sm text-muted-foreground">OK</p>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3">Link URL</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Source Page</th>
                  </tr>
                </thead>
                <tbody>
                  {allLinks.slice(0, 200).map((link, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-3 truncate max-w-xs">{link.url}</td>
                      <td className="p-3">
                        <Badge variant={link.status >= 400 ? "destructive" : link.status >= 300 ? "secondary" : "default"}>
                          {link.status || "unknown"}
                        </Badge>
                      </td>
                      <td className="p-3 truncate max-w-xs text-muted-foreground">{link.sourcePage}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {!data && (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Enter a URL to check for broken links
          </div>
        )}
      </div>
    </div>
  );
}
