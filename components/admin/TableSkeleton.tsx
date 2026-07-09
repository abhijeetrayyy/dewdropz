import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function TableSkeleton({ columns = 5, rows = 10 }: { columns?: number, rows?: number }) {
  return (
    <Card className="shadow-sm border-gray-200">
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {Array.from({ length: columns }).map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: rows }).map((_, r) => (
              <TableRow key={r}>
                {Array.from({ length: columns }).map((_, c) => (
                  <TableCell key={c}>
                    <Skeleton className={`h-4 ${c === 0 ? 'w-32' : 'w-24'}`} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
