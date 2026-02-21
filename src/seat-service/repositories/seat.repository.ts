import { Seat, ISeat } from '../../shared/models/seat.model';
import { FilterQuery, UpdateQuery, ClientSession } from 'mongoose';

export class SeatRepository {
  async findOne(filter: FilterQuery<ISeat>, session?: ClientSession): Promise<ISeat | null> {
    return Seat.findOne(filter).session(session || null);
  }

  async find(
    filter: FilterQuery<ISeat>,
    options?: { limit?: number; sort?: any; session?: ClientSession }
  ): Promise<ISeat[]> {
    let query = Seat.find(filter);

    if (options?.sort) query = query.sort(options.sort);
    if (options?.limit) query = query.limit(options.limit);
    if (options?.session) query = query.session(options.session);

    return query.exec();
  }

  async findOneAndUpdate(
    filter: FilterQuery<ISeat>,
    update: UpdateQuery<ISeat>,
    options: { returnDocument: 'after'; session: ClientSession }
  ): Promise<ISeat | null> {
    return Seat.findOneAndUpdate(filter, update, {
      new: true,
      session: options.session,
    });
  }

  async updateMany(
    filter: FilterQuery<ISeat>,
    update: UpdateQuery<ISeat>,
    session?: ClientSession
  ): Promise<number> {
    const result = await Seat.updateMany(filter, update).session(session || null);
    return result.modifiedCount;
  }

  async countDocuments(filter: FilterQuery<ISeat>): Promise<number> {
    return Seat.countDocuments(filter);
  }
}
