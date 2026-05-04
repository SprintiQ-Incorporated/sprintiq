/**
 * Page Breadcrumb Component
 *
 * Pre-styled breadcrumb navigation for SprintiQ pages.
 * Use on all pages except the homepage.
 */

"use client";

import Link from "next/link";
import { Home } from "lucide-react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbItemData {
  label: string;
  href: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItemData[];
  currentPage: string;
  className?: string;
}

export function PageBreadcrumb({
  items,
  currentPage,
  className = "",
}: PageBreadcrumbProps) {
  return (
    <div className={`container mx-auto px-4 pt-24 pb-4 ${className}`}>
      <Breadcrumb>
        <BreadcrumbList className="text-emerald-200/70">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                href="/"
                className="flex items-center hover:text-emerald-300 transition-colors"
                aria-label="SprintiQ Home"
              >
                <Home className="w-4 h-4" />
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {items.map((item) => (
            <BreadcrumbItem key={item.href}>
              <BreadcrumbSeparator className="text-emerald-500/50" />
              <BreadcrumbLink asChild>
                <Link
                  href={item.href}
                  className="hover:text-emerald-300 transition-colors"
                >
                  {item.label}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          ))}
          <BreadcrumbItem>
            <BreadcrumbSeparator className="text-emerald-500/50" />
            <BreadcrumbPage className="text-emerald-100 font-medium">
              {currentPage}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}

export default PageBreadcrumb;
