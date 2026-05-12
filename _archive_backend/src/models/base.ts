import { db } from '@/config/database';
import { Knex } from 'knex';

export abstract class BaseModel {
  protected static tableName: string;
  protected static db = db;

  static get query(): Knex.QueryBuilder {
    return this.db(this.tableName);
  }

  static async findById(id: string): Promise<any> {
    return this.query.where('id', id).first();
  }

  static async findAll(conditions: Record<string, any> = {}): Promise<any[]> {
    return this.query.where(conditions);
  }

  static async create(data: Record<string, any>): Promise<any> {
    const [result] = await this.query.insert(data).returning('*');
    return result;
  }

  static async update(id: string, data: Record<string, any>): Promise<any> {
    const [result] = await this.query
      .where('id', id)
      .update({ ...data, updated_at: new Date() })
      .returning('*');
    return result;
  }

  static async delete(id: string): Promise<boolean> {
    const result = await this.query.where('id', id).del();
    return result > 0;
  }

  static async exists(conditions: Record<string, any>): Promise<boolean> {
    const result = await this.query.where(conditions).first();
    return !!result;
  }

  static async count(conditions: Record<string, any> = {}): Promise<number> {
    const result = await this.query.where(conditions).count('* as count').first();
    return parseInt(result?.count as string) || 0;
  }
}