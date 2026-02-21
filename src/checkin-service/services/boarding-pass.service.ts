import QRCode from 'qrcode';
import { createLogger } from '../../shared/utils/logger';

const logger = createLogger('boarding-pass-service');

export interface BoardingPassData {
  passengerId: string;
  flightId: string;
  seatId: string;
  gate?: string;
  boardingTime?: Date;
}

export interface BoardingPass {
  passengerId: string;
  flightId: string;
  seatId: string;
  gate: string;
  boardingTime: Date;
  qrCode: string;
}

export class BoardingPassService {
  async generate(data: BoardingPassData): Promise<BoardingPass> {
    const gate = data.gate || 'B12';
    const boardingTime = data.boardingTime || new Date(Date.now() + 4 * 60 * 60 * 1000);

    const qrData = JSON.stringify({
      passengerId: data.passengerId,
      flightId: data.flightId,
      seatId: data.seatId,
      gate,
      boardingTime,
      issuedAt: new Date(),
    });

    const qrCode = await QRCode.toDataURL(qrData);

    logger.info('Boarding pass generated', {
      passengerId: data.passengerId,
      flightId: data.flightId,
      seatId: data.seatId,
    });

    return {
      passengerId: data.passengerId,
      flightId: data.flightId,
      seatId: data.seatId,
      gate,
      boardingTime,
      qrCode,
    };
  }
}
