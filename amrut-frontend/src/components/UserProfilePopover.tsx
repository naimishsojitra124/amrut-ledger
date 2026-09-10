import { ChevronsUpDown, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import { cn } from "@/lib/utils";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

type UserProfilePopoverProps = {
  expanded?: boolean;
};

function ProfileAvatar({
  initials,
  className,
}: {
  initials: string;
  className?: string;
}) {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );
}

export function UserProfilePopover({
  expanded: expandedProp,
}: UserProfilePopoverProps) {
  const navigate = useNavigate();

  const { isOpen } = useSidebar();
  const expanded = expandedProp ?? isOpen;

  const { user, userInitials, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Open user menu"
          className={cn(
            "flex rounded-lg transition-colors hover:bg-[#F6F6F6]",
            expanded
              ? "w-full items-center justify-between gap-2 p-2 text-left"
              : "h-10 w-10 items-center justify-center p-1.5",
          )}
        >
          {expanded ? (
            <>
              <div className="flex min-w-0 items-center gap-2">
                <ProfileAvatar initials={userInitials} />

                <div className="min-w-0">
                  <p
                    title={user?.fullName || "User"}
                    className="truncate text-sm font-medium leading-4 text-[#121212]"
                  >
                    {user?.fullName || "User"}
                  </p>

                  <p
                    title={user?.email || ""}
                    className="truncate text-xs font-medium leading-4 text-[#757575]"
                  >
                    {user?.email || ""}
                  </p>
                </div>
              </div>

              <ChevronsUpDown className="h-5 w-5 shrink-0 text-[#757575]" />
            </>
          ) : (
            <ProfileAvatar initials={userInitials} />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="end"
        side="top"
        sideOffset={10}
        className="w-64 max-w-[calc(100vw-1rem)] rounded-lg border border-neutral-200 p-0 shadow-xl"
      >
        <div className="flex min-w-0 items-center gap-2 px-3 py-3">
          <ProfileAvatar initials={userInitials} />

          <div className="min-w-0">
            <p
              title={user?.fullName || "User"}
              className="truncate text-sm font-medium leading-4 text-[#121212]"
            >
              {user?.fullName || "User"}
            </p>

            <p
              title={user?.email || ""}
              className="truncate text-xs font-medium leading-4 text-[#757575]"
            >
              {user?.email || ""}
            </p>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-0.5 p-1">
          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 rounded-md px-3 py-2.5 text-sm font-medium"
            onClick={() => navigate("/profile")}
          >
            <User className="h-4 w-4" />
            Profile
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="w-full justify-start gap-2 rounded-md px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
