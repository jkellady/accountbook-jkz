/**
 * @fileoverview Tax Position Module barrel exports.
 *
 * Provides a single import point for all tax position components:
 *
 *   import { TaxPositionView } from "@/components/tax-position";
 *
 * Also re-exports server actions for convenience:
 *
 *   import { getTaxForecast } from "@/lib/actions/taxPosition";
 *
 * DISCLAIMER: This is a simplified directional estimate. Your actual tax
 * liability depends on many factors. Consult your tax agent for filing.
 *
 * @module components/tax-position
 */

// Components
export { TaxPositionView } from "./TaxPositionView";
export { TaxVerdict } from "./TaxVerdict";
export { ForecastMath } from "./ForecastMath";
export { CP500Schedule } from "./CP500Schedule";
export { TaxPrepView } from "./TaxPrepView";
