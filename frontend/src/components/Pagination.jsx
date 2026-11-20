import React from "react";

export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  pageSize = 25,
  totalItems = 0,
  onPageChange,
  onPageSizeChange,
  className = "",
  position = "top" // "top" | "bottom"
}) {
  if (totalItems === 0) return null;

  const numericPageSize = pageSize === "all" ? totalItems : Number(pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * numericPageSize + 1;
  const endItem = pageSize === "all" ? totalItems : Math.min(currentPage * numericPageSize, totalItems);

  const handlePageClick = (page) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);

    // If changing from the bottom bar, smoothly scroll to top of table
    if (position === "bottom") {
      const tableWrap = document.querySelector(".table-wrap");
      if (tableWrap) {
        tableWrap.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  };

  // Generate intelligent page numbers with ellipsis
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [];
    if (currentPage <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i);
      pages.push("...");
      pages.push(totalPages);
    } else if (currentPage >= totalPages - 3) {
      pages.push(1);
      pages.push("...");
      for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      pages.push("...");
      pages.push(currentPage - 1);
      pages.push(currentPage);
      pages.push(currentPage + 1);
      pages.push("...");
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className={`pagination-toolbar ${position === "bottom" ? "bottom" : ""} ${className}`}>
      {/* Left: Summary info */}
      <div className="pagination-info">
        <span>
          Showing <strong>{startItem.toLocaleString()}</strong>–<strong>{endItem.toLocaleString()}</strong> of{" "}
          <strong>{totalItems.toLocaleString()}</strong> leads
        </span>
        {pageSize !== "all" && totalPages > 1 && (
          <span className="pagination-page-tag">
            (Page {currentPage} of {totalPages})
          </span>
        )}
      </div>

      {/* Right: Controls & Page size */}
      <div className="pagination-actions">
        {/* Page Size Selector */}
        <div className="pagination-size-group">
          <label htmlFor={`page-size-select-${position}`} className="pagination-size-label">
            Rows:
          </label>
          <select
            id={`page-size-select-${position}`}
            value={pageSize}
            onChange={(e) =>
              onPageSizeChange(e.target.value === "all" ? "all" : Number(e.target.value))
            }
            className="page-size-select"
            title="Select leads per page"
          >
            <option value={15}>15 / page</option>
            <option value={25}>25 / page</option>
            <option value={50}>50 / page</option>
            <option value={100}>100 / page</option>
            <option value="all">Show All</option>
          </select>
        </div>

        {/* Page Navigation Buttons */}
        {pageSize !== "all" && totalPages > 1 && (
          <div className="pagination-pages" role="navigation" aria-label="Pagination">
            <button
              type="button"
              className="page-num-btn nav-btn"
              onClick={() => handlePageClick(1)}
              disabled={currentPage <= 1}
              title="First Page"
            >
              «
            </button>
            <button
              type="button"
              className="page-num-btn nav-btn"
              onClick={() => handlePageClick(currentPage - 1)}
              disabled={currentPage <= 1}
              title="Previous Page"
            >
              ‹
            </button>

            {pageNumbers.map((p, idx) => {
              if (p === "...") {
                return (
                  <span key={`ellipsis-${idx}`} className="page-ellipsis">
                    …
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  className={`page-num-btn ${isCurrent ? "active" : ""}`}
                  onClick={() => handlePageClick(p)}
                  aria-current={isCurrent ? "page" : undefined}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              className="page-num-btn nav-btn"
              onClick={() => handlePageClick(currentPage + 1)}
              disabled={currentPage >= totalPages}
              title="Next Page"
            >
              ›
            </button>
            <button
              type="button"
              className="page-num-btn nav-btn"
              onClick={() => handlePageClick(totalPages)}
              disabled={currentPage >= totalPages}
              title="Last Page"
            >
              »
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
