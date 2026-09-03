import { prisma } from '../src/prisma'

const CATEGORIES = ['Account and Access', 'Hardware', 'Software', 'Network']

const REQUESTERS: { name: string; email: string; isActive: boolean }[] = [
  { name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com', isActive: true },
  { name: 'Michael Brown', email: 'michael.brown@example.com', isActive: true },
  { name: 'Sarah Wilson', email: 'sarah.wilson@example.com', isActive: true },
  { name: 'David Lee', email: 'david.lee@example.com', isActive: true },
  { name: 'Former Employee', email: 'former.employee@example.com', isActive: false },
]

async function main() {
  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  for (const requester of REQUESTERS) {
    await prisma.requesterUser.upsert({
      where: { email: requester.email },
      update: { name: requester.name, isActive: requester.isActive },
      create: requester,
    })
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
