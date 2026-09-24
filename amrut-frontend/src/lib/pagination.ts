// The page numbers to show, with "..." standing in for the stretches that are hidden.
// Always keeps the first and last page visible plus a window around the current one.
export function renderPaginationItems(currentPage: number, pageCount: number) {
  if (pageCount <= 5) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const items: Array<number | "..."> = [1];

  if (currentPage > 3) {
    items.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(pageCount - 1, currentPage + 1);

  for (let page = start; page <= end; page += 1) {
    items.push(page);
  }

  if (currentPage < pageCount - 2) {
    items.push("...");
  }

  items.push(pageCount);

  return items;
}

// Zero-based, for the tables that hold a page index rather than a page number.
export function clampPageIndex(nextPageIndex: number, totalPages: number) {
  return Math.min(Math.max(nextPageIndex, 0), totalPages - 1);
}
