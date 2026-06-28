import { create } from 'zustand';

export const useAuthStore = create((set) => ({
  token:        null,
  actor:        null,
  jurisdiction: null,

  setAuth: ({ token, actor, jurisdiction }) => {
    sessionStorage.setItem('logicos_token', token);
    sessionStorage.setItem('logicos_actor', JSON.stringify(actor));
    if (jurisdiction) sessionStorage.setItem('logicos_jurisdiction', JSON.stringify(jurisdiction));
    set({ token, actor, jurisdiction });
  },

  clearAuth: () => {
    sessionStorage.removeItem('logicos_token');
    sessionStorage.removeItem('logicos_actor');
    sessionStorage.removeItem('logicos_jurisdiction');
    set({ token: null, actor: null, jurisdiction: null });
  },

  rehydrate: () => {
    const token        = sessionStorage.getItem('logicos_token');
    const actor        = JSON.parse(sessionStorage.getItem('logicos_actor') || 'null');
    const jurisdiction = JSON.parse(sessionStorage.getItem('logicos_jurisdiction') || 'null');
    set({ token, actor, jurisdiction });
  },
}));
