import { db } from '../config/database'
import { Knex } from 'knex'

export abstract class BaseModel {
  protected static tableName: string
  protected static db: Knex = db

  static query() {
    return this.db(this.tableName)
  }

  static async findById(id: string) {
    return this.query().where('id', id).first()
  }

  static async findAll(options: {
    limit?: number
    offset?: number
    orderBy?: string
    orderDirection?: 'asc' | 'desc'
  } = {}) {
    const { limit = 20, offset = 0, orderBy = 'created_at', orderDirection = 'desc' } = options
    
    return this.query()
      .limit(limit)
      .offset(offset)
      .orderBy(orderBy, orderDirection)
  }

  static async create(data: any) {
    const [result] = await this.query().insert(data).returning('*')
    return result
  }

  static async update(id: string, data: any) {
    const [result] = await this.query()
      .where('id', id)
      .update({ ...data, updated_at: new Date() })
      .returning('*')
    return result
  }

  static async delete(id: string) {
    return this.query().where('id', id).del()
  }

  static async count(whereClause?: any) {
    const result = await this.query()
      .count('* as count')
      .where(whereClause || {})
      .first()
    return parseInt(result?.count as string) || 0
  }
}