import { useState, type ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Maximize2, ArrowRight } from 'lucide-react';

interface ZoomableTableProps {
  /** Title shown in the enlarged dialog. */
  title: string;
  /** The table (or any content) to render normally and again, enlarged, inside the dialog. */
  children: ReactNode;
  className?: string;
}

/**
 * Wraps a table so clicking it opens the same table enlarged in a full-screen
 * dialog with a "رجوع" (back) button to return to the page.
 */
export function ZoomableTable({ title, children, className }: ZoomableTableProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') setOpen(true);
        }}
        className={`cursor-zoom-in transition hover:brightness-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md ${className ?? ''}`}
        title="اضغط للتكبير"
      >
        {children}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="max-w-[96vw] w-[96vw] max-h-[92vh] overflow-hidden flex flex-col p-0"
          dir="rtl"
        >
          <DialogHeader className="px-4 pt-4 pb-2 flex-row items-center justify-between space-y-0">
            <DialogTitle className="flex items-center gap-2">
              <Maximize2 className="h-4 w-4 text-muted-foreground" />
              {title}
            </DialogTitle>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(false)}>
              <ArrowRight className="h-4 w-4" /> رجوع
            </Button>
          </DialogHeader>
          <div className="flex-1 overflow-auto px-4 pb-4">{children}</div>
        </DialogContent>
      </Dialog>
    </>
  );
}
