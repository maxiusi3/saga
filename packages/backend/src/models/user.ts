import { BaseModel } from './base'
import { User, CreateUserInput, UpdateUserInput } from '@saga/shared'
import bcrypt from 'bcryptjs'

export class UserModel extends BaseModel {
  protected static tableName = 'users'

  static async findByEmail(email: string): Promise<User | undefined> {
    return this.query().where('email', email).first()
  }

  static async findByPhone(phone: string): Promise<User | undefined> {
    return this.query().where('phone', phone).first()
  }

  static async findByOAuth(provider: string, oauthId: string): Promise<User | undefined> {
    return this.query()
      .where('oauth_provider', provider)
      .where('oauth_id', oauthId)
      .first()
  }

  static async createUser(userData: CreateUserInput): Promise<User> {
    const data: any = {
      name: userData.name,
      email: userData.email,
      phone: userData.phone,
      oauth_provider: userData.oauthProvider,
      oauth_id: userData.oauthId,
    }

    // Hash password if provided
    if (userData.password) {
      data.password_hash = await bcrypt.hash(userData.password, 12)
    }

    return this.create(data)
  }

  static async updateUser(id: string, userData: UpdateUserInput): Promise<User> {
    return this.update(id, userData)
  }

  static async verifyPassword(user: User, password: string): Promise<boolean> {
    const userWithPassword = await this.query()
      .select('password_hash')
      .where('id', user.id)
      .first()

    if (!userWithPassword?.password_hash) {
      return false
    }

    return bcrypt.compare(password, userWithPassword.password_hash)
  }

  static async updatePassword(id: string, newPassword: string): Promise<void> {
    const passwordHash = await bcrypt.hash(newPassword, 12)
    await this.update(id, { password_hash: passwordHash })
  }

  static async getUserWithProjectRoles(id: string) {
    const user = await this.findById(id)
    if (!user) return null

    const projectRoles = await this.db('project_roles')
      .where('user_id', id)
      .select('*')

    return {
      ...user,
      projectRoles,
    }
  }

  static async searchUsers(query: string, limit = 10) {
    return this.query()
      .where('name', 'ilike', `%${query}%`)
      .orWhere('email', 'ilike', `%${query}%`)
      .limit(limit)
      .select('id', 'name', 'email')
  }
}