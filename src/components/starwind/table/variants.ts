import { tv } from "tailwind-variants";

// 本站改造：视觉（字号、内边距、分隔线、悬停底色）统一由 src/styles/site.css 的 .tbl 负责，
// 这里只保留结构性样式，避免工具类覆盖设计稿的数值。
export const table = tv({
  base: "w-full caption-bottom border-collapse",
});

export const tableBody = tv({
  base: "",
});

export const tableCaption = tv({
  base: "text-muted-foreground mt-4 text-sm",
});

export const tableCell = tv({
  base: "align-middle",
});

export const tableFoot = tv({
  base: "border-t font-medium",
});

export const tableHead = tv({
  base: "text-left align-middle whitespace-nowrap",
});

export const tableHeader = tv({
  base: "",
});

export const tableRow = tv({
  base: "transition-colors",
});
