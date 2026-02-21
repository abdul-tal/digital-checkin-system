import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('mock-weight-service');

export interface WeighBagRequest {
  bagId: string;
}

export interface WeighBagResponse {
  bagId: string;
  weight: number;
  measuredAt: Date;
  unit: 'kg';
}

export class MockWeightService {
  private readonly delay: number;

  constructor() {
    this.delay = parseInt(process.env.MOCK_WEIGHT_DELAY_MS || '500');
  }

  async weighBag(req: WeighBagRequest): Promise<WeighBagResponse> {
    await this.sleep(this.delay);

    const weight = this.generateRealisticWeight();

    logger.info('Bag weighed', {
      bagId: req.bagId,
      weight: weight.toFixed(2),
      unit: 'kg',
    });

    return {
      bagId: req.bagId,
      weight: parseFloat(weight.toFixed(1)),
      measuredAt: new Date(),
      unit: 'kg',
    };
  }

  private generateRealisticWeight(): number {
    const rand = Math.random();

    // 70% within limit (15-25kg)
    if (rand < 0.7) {
      return 15 + Math.random() * 10;
    }
    // 20% overweight (25-30kg)
    else if (rand < 0.9) {
      return 25 + Math.random() * 5;
    }
    // 10% severely overweight (30-33kg)
    else {
      return 30 + Math.random() * 3;
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async weighBagWithWeight(bagId: string, weight: number): Promise<WeighBagResponse> {
    await this.sleep(this.delay);

    logger.info('Bag weighed (fixed weight)', { bagId, weight });

    return {
      bagId,
      weight,
      measuredAt: new Date(),
      unit: 'kg',
    };
  }
}
