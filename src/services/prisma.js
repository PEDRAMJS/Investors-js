const { PrismaClient } = require('@prisma/client')

// Create Prisma Client with proper configuration
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] 
    : ['error'],
  datasource: {
    // For direct database connection
    url: process.env.DATABASE_URL,
  },
  // Or if using Prisma Accelerate:
  // accelerate: {
  //   url: process.env.PRISMA_ACCELERATE_URL,
  // }
})

class PrismaService {
  constructor() {
    this.prisma = prisma
  }

  async connect() {
    try {
      // Test connection
      await this.prisma.$queryRaw`SELECT 1`
      console.log('✅ Prisma connected to database')
    } catch (error) {
      console.error('❌ Prisma connection failed:', error.message)
      throw error
    }
  }

  async disconnect() {
    await this.prisma.$disconnect()
    console.log('❌ Prisma disconnected from database')
  }

  get client() {
    return this.prisma
  }
}

module.exports = new PrismaService()