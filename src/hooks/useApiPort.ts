export function useApiPort(): number {
  return Number(import.meta.env.VITE_API_PORT ?? 7842)
}
