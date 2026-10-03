"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

const DesignContext = createContext('classic');
export const useDesign = () => useContext(DesignContext);

// Administrator settings are the only source of theme selection. No visitor preference.
export default function DesignProvider({ initialDesigns, children }) {
  const pathname = usePathname();
  const [designs, setDesigns] = useState(initialDesigns);
  useEffect(() => {
    const update = event => setDesigns(previous => ({ ...previous, ...event.detail }));
    window.addEventListener('nexus-design-saved', update);
    return () => window.removeEventListener('nexus-design-saved', update);
  }, []);
  const selected = pathname?.startsWith('/tianwei') ? designs.adminDesign : designs.frontendDesign;
  const design = selected === 'editorial' ? 'editorial' : 'classic';
  return <DesignContext.Provider value={design}><div data-design={design} className="nq-design-root">{children}</div></DesignContext.Provider>;
}
