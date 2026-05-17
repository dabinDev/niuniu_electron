import { create } from "zustand";
import { persist } from "zustand/middleware";
import { normalizeApiBaseUrl } from "../core/api/apiBaseUrl";

export type ThemeMode = "dark" | "light";
export type StockLinkClient = "tdx" | "ths";
export type InviteAccessMode = "trial" | "invite";

export type AccessActivation = {
  accessId: string;
  accessMode: InviteAccessMode;
  activatedAt: string;
  activationSecret: string;
  machineCode: string;
  machineCodeVersion: string;
};

export type AppPreferences = {
  accessActivation: AccessActivation | null;
  apiBaseUrl: string;
  inviteAccessMode: InviteAccessMode | null;
  inviteAcknowledged: boolean;
  inviteCode: string;
  motionEnabled: boolean;
  sidebarCollapsed: boolean;
  stockLinkClient: StockLinkClient;
  tdxPath: string;
  thsPath: string;
  theme: ThemeMode;
  acknowledgeInviteAccess: (value: { code?: string; mode: InviteAccessMode }) => void;
  clearAccessActivation: () => void;
  saveAccessActivation: (value: AccessActivation) => void;
  setApiBaseUrl: (value: string) => void;
  setMotionEnabled: (value: boolean) => void;
  setSidebarCollapsed: (value: boolean) => void;
  setStockLinkSettings: (value: { client: StockLinkClient; tdxPath: string; thsPath: string }) => void;
  setTheme: (value: ThemeMode) => void;
};

export const usePreferencesStore = create<AppPreferences>()(
  persist(
    (set) => ({
      apiBaseUrl: normalizeApiBaseUrl(),
      accessActivation: null,
      inviteAccessMode: null,
      inviteAcknowledged: false,
      inviteCode: "",
      motionEnabled: true,
      sidebarCollapsed: false,
      stockLinkClient: "tdx",
      tdxPath: "",
      thsPath: "",
      theme: "dark",
      acknowledgeInviteAccess: (value) =>
        set({
          inviteAccessMode: value.mode,
          inviteAcknowledged: true,
          inviteCode: value.mode === "invite" ? value.code?.trim() ?? "" : ""
        }),
      clearAccessActivation: () =>
        set({
          accessActivation: null,
          inviteAccessMode: null,
          inviteAcknowledged: false,
          inviteCode: ""
        }),
      saveAccessActivation: (value) =>
        set({
          accessActivation: value,
          inviteAccessMode: value.accessMode,
          inviteAcknowledged: true,
          inviteCode: ""
        }),
      setApiBaseUrl: (value) => set({ apiBaseUrl: normalizeApiBaseUrl(value) }),
      setMotionEnabled: (value) => set({ motionEnabled: value }),
      setSidebarCollapsed: (value) => set({ sidebarCollapsed: value }),
      setStockLinkSettings: (value) =>
        set({
          stockLinkClient: value.client,
          tdxPath: value.tdxPath,
          thsPath: value.thsPath
        }),
      setTheme: (value) => set({ theme: value })
    }),
    {
      name: "niuniu-electron-preferences",
      partialize: (state) => ({
        apiBaseUrl: state.apiBaseUrl,
        accessActivation: state.accessActivation,
        inviteAccessMode: state.inviteAccessMode,
        inviteAcknowledged: state.inviteAcknowledged,
        inviteCode: state.inviteCode,
        motionEnabled: state.motionEnabled,
        sidebarCollapsed: state.sidebarCollapsed,
        stockLinkClient: state.stockLinkClient,
        tdxPath: state.tdxPath,
        thsPath: state.thsPath,
        theme: state.theme
      })
    }
  )
);
