import { create } from "zustand";

type UiState = {
  sidebarOpen: boolean;
  activeDossierSection: string;
  evidenceDrawerOpen: boolean;
  selectedEvidenceIds: string[];
  setSidebarOpen: (open: boolean) => void;
  setActiveDossierSection: (section: string) => void;
  openEvidence: (ids: string[]) => void;
  setEvidenceDrawerOpen: (open: boolean) => void;
};

export const useUiStore = create<UiState>((set) => ({
  sidebarOpen: false,
  activeDossierSection: "overview",
  evidenceDrawerOpen: false,
  selectedEvidenceIds: [],
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setActiveDossierSection: (activeDossierSection) => set({ activeDossierSection }),
  openEvidence: (selectedEvidenceIds) => set({ selectedEvidenceIds, evidenceDrawerOpen: true }),
  setEvidenceDrawerOpen: (evidenceDrawerOpen) =>
    set({ evidenceDrawerOpen, ...(evidenceDrawerOpen ? {} : { selectedEvidenceIds: [] }) }),
}));
