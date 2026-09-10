import { useSidebarStore } from "@/store/sidebar.store";

export function useSidebar() {
  const isOpen = useSidebarStore((state) => state.isOpen);
  const toggle = useSidebarStore((state) => state.toggle);
  const open = useSidebarStore((state) => state.open);
  const close = useSidebarStore((state) => state.close);
  const setOpen = useSidebarStore((state) => state.setOpen);

  return {
    isOpen,
    toggle,
    open,
    close,
    setOpen,
  };
}
