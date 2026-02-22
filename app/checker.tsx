"use client";

import { useState } from "react";
import SearchBar from "./searchbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface LinkResult {
  url: string;
  status: number;
  sourcePage: string;
  category: "broken" | "redirect" | "ok" | "unchecked";
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

type Filter = "all" | "broken" | "redirect" | "ok" | "unchecked";
type ExportFormat = "json" | "csv" | "markdown";

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function exportLinks(links: LinkResult[], healthScore: number, pagesCount: number, format: ExportFormat) {
  const ts = new Date().toISOString().slice(0, 10);
  const broken = links.filter((l) => l.category === "broken");
  const redirects = links.filter((l) => l.category === "redirect");
  const ok = links.filter((l) => l.category === "ok");
  const unchecked = links.filter((l) => l.category === "unchecked");

  if (format === "json") {
    const report = {
      date: ts,
      healthScore,
      pagesScanned: pagesCount,
      summary: { total: links.length, broken: broken.length, redirects: redirects.length, ok: ok.length, unchecked: unchecked.length },
      links,
    };
    downloadBlob(JSON.stringify(report, null, 2), `dead-link-report-${ts}.json`, "application/json");
  } else if (format === "csv") {
    const rows = [["Link URL", "Status", "Category", "Found On"]];
    for (const l of links) {
      rows.push([l.url, l.category === "unchecked" ? "N/A" : String(l.status), l.category, l.sourcePage]);
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    downloadBlob(csv, `dead-link-report-${ts}.csv`, "text/csv");
  } else {
    let md = `# Dead Link Report\n\n**Date:** ${ts}\n**Pages Scanned:** ${pagesCount}\n**Link Health:** ${healthScore}%\n\n`;
    md += `| Metric | Count |\n|--------|-------|\n`;
    md += `| Total Links | ${links.length} |\n`;
    md += `| Broken | ${broken.length} |\n`;
    md += `| Redirects | ${redirects.length} |\n`;
    md += `| OK | ${ok.length} |\n`;
    md += `| Not Crawled | ${unchecked.length} |\n\n`;
    if (broken.length > 0) {
      md += `## Broken Links\n\n| URL | Status | Found On |\n|-----|--------|----------|\n`;
      for (const l of broken) md += `| ${l.url} | ${l.status} | ${l.sourcePage} |\n`;
      md += "\n";
    }
    if (redirects.length > 0) {
      md += `## Redirects\n\n| URL | Status | Found On |\n|-----|--------|----------|\n`;
      for (const l of redirects) md += `| ${l.url} | ${l.status} | ${l.sourcePage} |\n`;
      md += "\n";
    }
    if (unchecked.length > 0) {
      md += `## Not Crawled (External)\n\n| URL | Found On |\n|-----|----------|\n`;
      for (const l of unchecked) md += `| ${l.url} | ${l.sourcePage} |\n`;
      md += "\n";
    }
    downloadBlob(md, `dead-link-report-${ts}.md`, "text/markdown");
  }
}

export default function Checker() {
  const [data, setData] = useState<any[] | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("json");

  const pages = data || [];
  const crawledUrls = new Set(pages.map((p: any) => p?.url).filter(Boolean));
  const allLinks: LinkResult[] = [];

  for (const page of pages) {
    if (!page?.url || !page?.content) continue;
    const found = extractLinks(page.content, page.url);
    for (const link of found) {
      const linkedPage = pages.find((p: any) => p.url === link);
      const status = linkedPage?.status || (linkedPage ? 200 : 0);
      let category: LinkResult["category"];
      if (!crawledUrls.has(link)) {
        category = "unchecked";
      } else if (status >= 400) {
        category = "broken";
      } else if (status >= 300) {
        category = "redirect";
      } else {
        category = "ok";
      }
      allLinks.push({ url: link, status, sourcePage: page.url, category });
    }
  }

  const broken = allLinks.filter((l) => l.category === "broken");
  const redirects = allLinks.filter((l) => l.category === "redirect");
  const okLinks = allLinks.filter((l) => l.category === "ok");
  const unchecked = allLinks.filter((l) => l.category === "unchecked");

  const filtered = filter === "all" ? allLinks : allLinks.filter((l) => l.category === filter);
  const healthScore = allLinks.length > 0
    ? Math.round(((okLinks.length + redirects.length) / Math.max(1, allLinks.length - unchecked.length)) * 100)
    : 0;

  function badgeVariant(cat: LinkResult["category"]): "destructive" | "secondary" | "default" | "outline" {
    switch (cat) {
      case "broken": return "destructive";
      case "redirect": return "secondary";
      case "ok": return "default";
      case "unchecked": return "outline";
    }
  }

  function statusLabel(link: LinkResult): string {
    if (link.category === "unchecked") return "Not Crawled";
    return String(link.status);
  }

  function scoreColor(score: number): string {
    if (score >= 90) return "text-green-400";
    if (score >= 70) return "text-yellow-400";
    if (score >= 50) return "text-orange-400";
    return "text-red-400";
  }

  function scoreBg(score: number): string {
    if (score >= 90) return "bg-green-500/10 border-green-500/20";
    if (score >= 70) return "bg-yellow-500/10 border-yellow-500/20";
    if (score >= 50) return "bg-orange-500/10 border-orange-500/20";
    return "bg-red-500/10 border-red-500/20";
  }

  return (
    <div className="flex flex-col h-screen">
      <SearchBar setDataValues={setData} />
      <div className="flex-1 overflow-auto p-4 max-w-6xl mx-auto w-full">
        {pages.length > 0 ? (
          <>
            {/* Health Score + Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
              <div className={`border rounded-lg p-4 text-center ${scoreBg(healthScore)}`}>
                <p className={`text-3xl font-bold ${scoreColor(healthScore)}`}>{healthScore}%</p>
                <p className="text-xs text-muted-foreground mt-1">Link Health</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{pages.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Pages Crawled</p>
              </div>
              <div className="border rounded-lg p-4 text-center">
                <p className="text-2xl font-bold">{allLinks.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Total Links</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-red-500/10 border-red-500/20">
                <p className="text-2xl font-bold text-red-400">{broken.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Broken</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-yellow-500/10 border-yellow-500/20">
                <p className="text-2xl font-bold text-yellow-400">{redirects.length}</p>
                <p className="text-xs text-muted-foreground mt-1">Redirects</p>
              </div>
              <div className="border rounded-lg p-4 text-center bg-green-500/10 border-green-500/20">
                <p className="text-2xl font-bold text-green-400">{okLinks.length}</p>
                <p className="text-xs text-muted-foreground mt-1">OK</p>
              </div>
            </div>

            {/* Success / Warning Banner */}
            {broken.length === 0 ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 mb-6 text-center">
                <p className="text-green-400 font-semibold text-lg">No broken links found!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  All {okLinks.length + redirects.length} checked links are healthy across {pages.length} pages.
                  {unchecked.length > 0 && ` ${unchecked.length} external links were not crawled.`}
                </p>
              </div>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 mb-6 text-center">
                <p className="text-red-400 font-semibold text-lg">
                  {broken.length} broken link{broken.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Review the broken links below and fix them on your website.
                </p>
              </div>
            )}

            {/* Download Controls */}
            <div className="flex items-center gap-2 mb-4">
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="markdown">Markdown</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportLinks(allLinks, healthScore, pages.length, exportFormat)}>
                Download All ({allLinks.length})
              </Button>
              {filter !== "all" && filtered.length > 0 && (
                <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => exportLinks(filtered, healthScore, pages.length, exportFormat)}>
                  Download Filtered ({filtered.length})
                </Button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {([
                ["all", `All (${allLinks.length})`],
                ["broken", `Broken (${broken.length})`],
                ["redirect", `Redirects (${redirects.length})`],
                ["ok", `OK (${okLinks.length})`],
                ["unchecked", `Not Crawled (${unchecked.length})`],
              ] as [Filter, string][]).map(([key, label]) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  onClick={() => setFilter(key)}
                  className="text-xs"
                >
                  {label}
                </Button>
              ))}
            </div>

            {/* Links Table */}
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">Link URL</th>
                    <th className="text-center p-3 font-medium w-28">Status</th>
                    <th className="text-left p-3 font-medium">Found On</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-8 text-center text-muted-foreground">
                        No links match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filtered.slice(0, 500).map((link, i) => (
                      <tr key={`${link.url}-${link.sourcePage}-${i}`} className="border-t hover:bg-muted/30 transition-colors">
                        <td className="p-3 truncate max-w-sm" title={link.url}>
                          <a href={link.url} target="_blank" rel="noreferrer" className="font-mono text-xs hover:text-primary hover:underline">
                            {link.url}
                          </a>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant={badgeVariant(link.category)}>
                            {statusLabel(link)}
                          </Badge>
                        </td>
                        <td className="p-3 truncate max-w-xs text-muted-foreground text-xs" title={link.sourcePage}>
                          {link.sourcePage}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {filtered.length > 500 && (
                <div className="p-3 text-center text-xs text-muted-foreground border-t">
                  Showing 500 of {filtered.length} links
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <svg
              height={64}
              width={64}
              viewBox="0 0 36 34"
              xmlSpace="preserve"
              xmlns="http://www.w3.org/2000/svg"
              className="fill-[#3bde77] opacity-30 animate-spider-pulse"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M9.13883 7.06589V0.164429L13.0938 0.164429V6.175L14.5178 7.4346C15.577 6.68656 16.7337 6.27495 17.945 6.27495C19.1731 6.27495 20.3451 6.69807 21.4163 7.46593L22.8757 6.175V0.164429L26.8307 0.164429V7.06589V7.95679L26.1634 8.54706L24.0775 10.3922C24.3436 10.8108 24.5958 11.2563 24.8327 11.7262L26.0467 11.4215L28.6971 8.08749L31.793 10.5487L28.7257 14.407L28.3089 14.9313L27.6592 15.0944L26.2418 15.4502C26.3124 15.7082 26.3793 15.9701 26.4422 16.2355L28.653 16.6566L29.092 16.7402L29.4524 17.0045L35.3849 21.355L33.0461 24.5444L27.474 20.4581L27.0719 20.3816C27.1214 21.0613 27.147 21.7543 27.147 22.4577C27.147 22.5398 27.1466 22.6214 27.1459 22.7024L29.5889 23.7911L30.3219 24.1177L30.62 24.8629L33.6873 32.5312L30.0152 34L27.246 27.0769L26.7298 26.8469C25.5612 32.2432 22.0701 33.8808 17.945 33.8808C13.8382 33.8808 10.3598 32.2577 9.17593 26.9185L8.82034 27.0769L6.05109 34L2.37897 32.5312L5.44629 24.8629L5.74435 24.1177L6.47743 23.7911L8.74487 22.7806C8.74366 22.6739 8.74305 22.5663 8.74305 22.4577C8.74305 21.7616 8.76804 21.0758 8.81654 20.4028L8.52606 20.4581L2.95395 24.5444L0.615112 21.355L6.54761 17.0045L6.908 16.7402L7.34701 16.6566L9.44264 16.2575C9.50917 15.9756 9.5801 15.6978 9.65528 15.4242L8.34123 15.0944L7.69155 14.9313L7.27471 14.407L4.20739 10.5487L7.30328 8.08749L9.95376 11.4215L11.0697 11.7016C11.3115 11.2239 11.5692 10.7716 11.8412 10.3473L9.80612 8.54706L9.13883 7.95679V7.06589Z"
              ></path>
            </svg>
            <h2 className="text-xl font-semibold text-muted-foreground">
              Spider Dead Link Checker
            </h2>
            <p className="text-sm text-muted-foreground max-w-md">
              Enter a website URL above to crawl and check for broken links.
              Spider will find all links on each page and verify their status.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
