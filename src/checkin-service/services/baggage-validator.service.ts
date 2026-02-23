import { WeightServiceClient } from '../clients/weight-service.client';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('baggage-validator');

export interface BagValidationResult {
  bagIndex: number;
  weight: number;
  status: 'OK' | 'OVERWEIGHT' | 'REJECTED';
  fee: number;
  reason?: string;
}

export interface BaggageValidation {
  valid: boolean;
  totalFee: number;
  bags: BagValidationResult[];
}

export class BaggageValidatorService {
  private readonly WEIGHT_LIMIT = 25;
  private readonly MAX_WEIGHT = 32;

  constructor(private weightClient: WeightServiceClient) {}

  async validate(bagCount: number, providedWeights?: number[]): Promise<BaggageValidation> {
    const bags: BagValidationResult[] = [];

    for (let i = 0; i < bagCount; i++) {
      let weight: number;

      if (providedWeights && providedWeights.length > i) {
        weight = providedWeights[i];
        logger.info('Using provided weight', { bagIndex: i, weight });
      } else {
        const bagId = `bag-${Date.now()}-${i}`;
        weight = await this.weightClient.weighBag(bagId);
        logger.info('Measured weight via Weight Service', { bagIndex: i, weight });
      }

      let result: BagValidationResult;

      if (weight > this.MAX_WEIGHT) {
        result = {
          bagIndex: i,
          weight,
          status: 'REJECTED',
          fee: 0,
          reason: `Exceeds maximum weight limit of ${this.MAX_WEIGHT}kg`,
        };
      } else if (weight > this.WEIGHT_LIMIT) {
        result = {
          bagIndex: i,
          weight,
          status: 'OVERWEIGHT',
          fee: this.calculateFee(weight),
        };
      } else {
        result = {
          bagIndex: i,
          weight,
          status: 'OK',
          fee: 0,
        };
      }

      bags.push(result);
      logger.info('Bag validated', result);
    }

    const hasRejected = bags.some((b) => b.status === 'REJECTED');
    const totalFee = bags
      .filter((b) => b.status === 'OVERWEIGHT')
      .reduce((sum, b) => sum + b.fee, 0);

    return {
      valid: !hasRejected,
      totalFee,
      bags,
    };
  }

  private calculateFee(weight: number): number {
    if (weight <= 25) return 0;
    if (weight <= 28) return 50;
    if (weight <= 32) return 100;
    return 0;
  }
}
