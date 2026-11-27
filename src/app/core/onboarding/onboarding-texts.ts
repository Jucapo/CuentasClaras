/** "Falta 1 paso" / "Faltan 4 pasos". */
export function pendingStepsText(pending: number): string {
  return pending === 1 ? 'Falta 1 paso' : `Faltan ${pending} pasos`;
}
