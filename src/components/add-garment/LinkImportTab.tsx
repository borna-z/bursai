import { TabsContent } from '@/components/ui/tabs';
import { LinkImportForm } from '@/components/LinkImportForm';

interface LinkImportTabProps {
  value: string;
  className?: string;
}

export function LinkImportTab({ value, className = 'mt-6' }: LinkImportTabProps) {
  return (
    <TabsContent value={value} className={className}>
      <LinkImportForm />
    </TabsContent>
  );
}
