export interface BlockedSlot {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
}

export interface GetBlockedSlotsResponse {
  slots: BlockedSlot[];
}

export interface ToggleBlockedSlotResponse {
  slot: BlockedSlot;
  blocked: boolean;
}
