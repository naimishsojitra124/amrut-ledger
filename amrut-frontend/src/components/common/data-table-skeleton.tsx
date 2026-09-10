import { Skeleton } from "@/components/ui/skeleton";
import { TableCell, TableRow } from "@/components/ui/table";

type DataTableSkeletonProps = {
  columns: number;
  rows?: number;
};

export function DataTableSkeleton({
  columns,
  rows = 6,
}: DataTableSkeletonProps) {
  return Array.from({ length: rows }, (_, rowIndex) => (
    <TableRow key={rowIndex} aria-hidden="true" className="h-16">
      {Array.from({ length: columns }, (_, columnIndex) => (
        <TableCell key={columnIndex}>
          <Skeleton
            className={`h-6 ${
              columnIndex === 0
                ? "w-6 rounded-md"
                : columnIndex === columns - 1
                  ? "ml-auto w-8 rounded-full text-center"
                  : columnIndex === 1
                    ? "w-20"
                    : "w-4/5"
            }`}
          />
        </TableCell>
      ))}
    </TableRow>
  ));
}
