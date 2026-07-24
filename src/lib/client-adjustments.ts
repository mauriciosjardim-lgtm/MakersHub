export interface ClientAdjustmentPoint {
  time?: string;
  change: string;
}

const ADJUSTMENTS_HEADER = "AJUSTES SOLICITADOS";
const POINT_PATTERN = /^\d+\.\s*\[([^\]]+)\]\s*(.+)$/;

export function maskClientAdjustmentTimecode(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 6);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, -2)}:${digits.slice(-2)}`;
  return `${digits.slice(0, -4)}:${digits.slice(-4, -2)}:${digits.slice(-2)}`;
}

export function normalizeClientAdjustmentTimecode(value: string): string {
  const masked = maskClientAdjustmentTimecode(value);
  if (!masked) return "";

  const parts = masked.split(":");
  if (parts.length === 1) return `00:${parts[0].padStart(2, "0")}`;
  return parts.map((part) => part.padStart(2, "0")).join(":");
}

export function isValidClientAdjustmentTimecode(value: string): boolean {
  if (!value.trim()) return true;
  const normalized = normalizeClientAdjustmentTimecode(value);
  const parts = normalized.split(":").map(Number);
  if (parts.some((part) => !Number.isInteger(part))) return false;
  if (parts.length === 2) return parts[1] >= 0 && parts[1] <= 59;
  if (parts.length === 3) {
    return parts[1] >= 0 && parts[1] <= 59 && parts[2] >= 0 && parts[2] <= 59;
  }
  return false;
}

export function parseClientAdjustmentFeedback(
  feedback?: string | null,
): ClientAdjustmentPoint[] | null {
  if (!feedback?.trim()) return null;

  const lines = feedback
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines[0]?.toUpperCase() !== ADJUSTMENTS_HEADER) return null;

  const points = lines.slice(1).flatMap((line) => {
    const match = line.match(POINT_PATTERN);
    if (!match) return [];

    const [, rawTime, rawChange] = match;
    const change = rawChange.trim();
    if (!change) return [];

    const time = rawTime.trim();
    return [
      {
        change,
        ...(time && time.toLowerCase() !== "geral" ? { time } : {}),
      },
    ];
  });

  return points.length > 0 ? points : null;
}
