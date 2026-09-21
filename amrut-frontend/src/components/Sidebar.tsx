import { useEffect } from "react";
import { LogOut } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import ADFLogo from "@/assets/ADFLogo.svg";
import OpenPanel from "@/assets/OpenPanel.svg";
import ClosePanel from "@/assets/closedPanelicon.svg";
import { useSidebar } from "@/hooks/use-sidebar";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BREAKPOINTS } from "@/lib/breakpoints";

import { ActionTooltip } from "./common/action-tooltip";
import { Button } from "./ui/button";
import { UserProfilePopover } from "./UserProfilePopover";
import { SIDEBAR_ITEMS } from "./sidebar-items";
import { usePermissions } from "@/hooks/use-permissions";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const Sidebar = () => {
  const { isOpen, toggle, close } = useSidebar();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();

  const { logout } = useAuth();

  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const isTablet = useMediaQuery(BREAKPOINTS.tablet);

  // Expanded means:
  // - mobile + drawer open
  // - desktop + sidebar open
  // Tablet intentionally stays compact.
  const isExpanded = isOpen && !isTablet;

  useEffect(() => {
    if (isMobile) {
      close();
    }
  }, [isMobile, close]);

  useEffect(() => {
    if (!isMobile) {
      document.body.style.overflow = "";
      return;
    }

    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isOpen]);

  useEffect(() => {
    if (isMobile && location.pathname) {
      close();
    }
  }, [location.pathname, isMobile, close]);

  const { can } = usePermissions();

  const visibleItems = SIDEBAR_ITEMS.filter(
    (item) => item.isVisible !== false && (item.permission === null || can(item.permission)),
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {isMobile && isOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px] md:hidden"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-72 -translate-x-full flex-col overflow-hidden border-r border-[#E2E8F0] bg-white transition-[transform,width] duration-300",
          isOpen && "translate-x-0",
          "md:relative md:z-auto md:w-16 md:translate-x-0",
          isExpanded ? "lg:w-64" : "lg:w-16",
        )}
        aria-label="Main navigation"
      >
        <div className="flex h-12 shrink-0 items-center justify-center border-b border-[#EEEEEE] bg-white px-2">
          {isExpanded ? (
            <div className="flex h-full w-full items-center justify-between">
              <img
                src={ADFLogo}
                alt="Amrut Dairy Farm"
                className="h-10 w-10 object-contain"
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={toggle}
                aria-label="Collapse sidebar"
                className="h-8 w-8 p-0 hover:bg-transparent"
              >
                <img
                  src={isMobile ? ClosePanel : OpenPanel}
                  alt=""
                  className="h-5 w-5"
                />
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label="Expand sidebar"
              className="h-8 w-8 p-0 hover:bg-transparent"
            >
              <img src={ClosePanel} alt="" className="h-5 w-5" />
            </Button>
          )}
        </div>

        <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 py-3">
          {visibleItems.map((item) => {
            const isActive = pathname === item.path;
            const link = (
              <NavLink
                key={item.id}
                to={item.path}
                className={cn(
                  "w-full flex items-center justify-center gap-2 p-2 rounded-[8px] transition-all text-sm font-medium",
                  isOpen ? "justify-start px-4" : "justify-center",
                  isActive
                    ? "bg-[#e6ecf0] text-[#266699]"
                    : "text-[#545454] hover:bg-gray-100",
                )}
              >
                <item.icon className="h-4.5 w-4.5 shrink-0" />
                {isExpanded && (
                  <span className="min-w-0 truncate">{item.title}</span>
                )}
              </NavLink>
            );

            return isExpanded ? (
              link
            ) : (
              <ActionTooltip
                key={item.id}
                label={item.title}
                align="center"
                side="right"
              >
                {link}
              </ActionTooltip>
            );
          })}
        </nav>

        <div className="shrink-0 bg-white border-t border-[#EEEEEE] p-2">
          {isExpanded ? (
            <UserProfilePopover expanded={isExpanded} />
          ) : (
            <div className="flex flex-col items-center self-stretch gap-3 p-2 rounded-[8px]">
              <UserProfilePopover expanded={isExpanded} />
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size={"icon-lg"}
                  title="Logout"
                  onClick={handleLogout}
                >
                  <LogOut className="text-red-500" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
