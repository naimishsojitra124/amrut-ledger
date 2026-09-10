const CACHE_KEY = "amrut:quick-entry-lookups";

type LookupCache = { savedAt: string; customers: unknown[]; milkTypes: unknown[]; products: unknown[] };

function read(): LookupCache {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as LookupCache;
  } catch { return { savedAt: "", customers: [], milkTypes: [], products: [] }; }
}

function save(patch: Partial<LookupCache>) {
  const next = { ...read(), ...patch, savedAt: new Date().toISOString() };
  localStorage.setItem(CACHE_KEY, JSON.stringify(next));
}

export const offlineQuickEntryCache = {
  get: read,
  saveCustomers: (customers: unknown[]) => save({ customers }),
  saveMilkTypes: (milkTypes: unknown[]) => save({ milkTypes }),
  saveProducts: (products: unknown[]) => save({ products }),
};
