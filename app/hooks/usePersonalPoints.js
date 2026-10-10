"use client";
import usePointSnapshot from './usePointSnapshot';

export default function usePersonalPoints(userId, disabled = false) {
  return usePointSnapshot(userId, { disabled });
}
