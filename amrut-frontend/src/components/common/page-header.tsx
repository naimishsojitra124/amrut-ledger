import type { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  icon: ReactNode;
};

const PageHeader = ({ title, description, icon }: Props) => {
  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-semibold text-xl text-[#1b414c]">{title}</span>
      </div>

      {description && (
        <span className="text-muted-foreground text-xs">{description}</span>
      )}
    </div>
  );
};

export default PageHeader;
