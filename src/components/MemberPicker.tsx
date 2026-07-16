import * as React from 'react';
import { Check, ChevronsUpDown, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MemberPickerOption {
  id: string;
  fullName: string;
}

interface MemberPickerProps {
  options: MemberPickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * مربع اختيار المنخرطين مع بحث فوري.
 * يعرض زراً يفتح نافذة منبثقة تحتوي على خانة بحث وقائمة كاملة
 * من المنخرطين. عند الكتابة يتم تصفية القائمة مباشرة.
 */
export function MemberPicker({
  options,
  value,
  onChange,
  placeholder = 'اختر المنخرط',
  searchPlaceholder = 'ابحث عن منخرط...',
  emptyText = 'لا يوجد منخرط مطابق',
  disabled = false,
  className,
}: MemberPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selected = React.useMemo(
    () => options.find((m) => m.id === value),
    [options, value],
  );

  // تصفية الخيارات حسب نص البحث (بحث غير حساس لحالة الأحرف)
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((m) => m.fullName.toLowerCase().includes(q));
  }, [options, search]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setSearch(''); }}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">
            {selected ? selected.fullName : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] p-0" align="start">
        <Command shouldFilter={false}>
          <div className="flex items-center border-b px-3" cmdk-input-wrapper="">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={searchPlaceholder}
              value={search}
              onValueChange={setSearch}
              className="h-9"
            />
          </div>
          <CommandList className="max-h-[280px] overflow-y-auto">
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {filtered.map((m) => (
                <CommandItem
                  key={m.id}
                  value={m.id}
                  onSelect={() => handleSelect(m.id)}
                  className="gap-2"
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      value === m.id ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{m.fullName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default MemberPicker;
