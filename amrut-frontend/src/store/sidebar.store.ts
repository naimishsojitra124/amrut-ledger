import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SidebarState = {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
  setOpen: (value: boolean) => void;
};

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isOpen: true,

      toggle: () =>
        set((state) => ({
          isOpen: !state.isOpen,
        })),

      open: () => set({ isOpen: true }),

      close: () => set({ isOpen: false }),

      setOpen: (value) => set({ isOpen: value }),
    }),
    {
      name: "sidebar-toggle",
    },
  ),
);
