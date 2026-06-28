import { createContext, useContext, useState, type ReactNode } from 'react';
import { TOWN_REGISTRY, type Town } from './towns';

interface TownContextValue {
  currentTown: Town;
  setCurrentTown: (town: Town) => void;
  allTowns: Town[];
}

const TownContext = createContext<TownContextValue | null>(null);

export function TownProvider({ children }: { children: ReactNode }) {
  const [currentTown, setCurrentTown] = useState<Town>(TOWN_REGISTRY[0]);

  return (
    <TownContext.Provider value={{ currentTown, setCurrentTown, allTowns: TOWN_REGISTRY }}>
      {children}
    </TownContext.Provider>
  );
}

export function useTown() { // eslint-disable-line react-refresh/only-export-components
  const ctx = useContext(TownContext);
  if (!ctx) throw new Error('useTown must be used within TownProvider');
  return ctx;
}
