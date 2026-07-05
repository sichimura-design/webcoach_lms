/**
 * Coach Schedule API (mock)
 * バックエンド未実装のため、モジュールレベルのメモリ上に保存するモック実装。
 * 実APIができ次第 bffClient 経由の呼び出しに差し替える想定。
 */

import { BlockedSlot } from '../types/coachSchedule';

const MOCK_LATENCY_MS = 300;

const blockedSlots = new Map<string, BlockedSlot>();

function slotKey(date: string, time: string): string {
  return `${date}_${time}`;
}

function delay<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), MOCK_LATENCY_MS));
}

export async function getBlockedSlots(): Promise<BlockedSlot[]> {
  return delay(Array.from(blockedSlots.values()));
}

export async function blockSlot(date: string, time: string): Promise<BlockedSlot> {
  const slot: BlockedSlot = { date, time };
  blockedSlots.set(slotKey(date, time), slot);
  return delay(slot);
}

export async function unblockSlot(date: string, time: string): Promise<void> {
  blockedSlots.delete(slotKey(date, time));
  return delay(undefined);
}
