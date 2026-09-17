import bcrypt from 'bcryptjs'
import { prisma } from '../src/prisma'

const CATEGORIES = ['Account and Access', 'Hardware', 'Software', 'Network']

const RELATED_SYSTEMS = [
  'Email',
  'Campus Wi-Fi',
  'VPN',
  'LEB2 App',
  'Grade Submission App',
  'Printer',
  'Corporate Laptop',
]

// Local development only -- never a real secret. Documented in README.md.
// Meets BR-08 (>=8 chars, upper, lower, digit, special).
const DEV_PASSWORD = 'DevPass123!'

type Role = 'REQUESTER' | 'IT_STAFF' | 'ADMINISTRATOR'

interface SeedUser {
  name: string
  email: string
  isActive: boolean
  role: Role
  // Migrated Lab 2 Requesters are forced through Change Password on first Lab 3 login (D-08).
  // Freshly seeded Staff/Administrator accounts skip that so they're immediately usable for
  // manual testing of their own screens.
  mustChangePassword: boolean
}

const USERS: SeedUser[] = [
  { name: 'Jennifer Anderson', email: 'jennifer.anderson@example.com', isActive: true, role: 'REQUESTER', mustChangePassword: true },
  { name: 'Michael Brown', email: 'michael.brown@example.com', isActive: true, role: 'REQUESTER', mustChangePassword: true },
  { name: 'Sarah Wilson', email: 'sarah.wilson@example.com', isActive: true, role: 'REQUESTER', mustChangePassword: true },
  { name: 'David Lee', email: 'david.lee@example.com', isActive: true, role: 'REQUESTER', mustChangePassword: true },
  { name: 'Former Employee', email: 'former.employee@example.com', isActive: false, role: 'REQUESTER', mustChangePassword: true },

  { name: 'Priya Nakamura', email: 'priya.nakamura@example.com', isActive: true, role: 'IT_STAFF', mustChangePassword: false },
  { name: 'Carlos Mendez', email: 'carlos.mendez@example.com', isActive: true, role: 'IT_STAFF', mustChangePassword: false },
  { name: 'Aisha Rahman', email: 'aisha.rahman@example.com', isActive: true, role: 'IT_STAFF', mustChangePassword: false },
  { name: 'Former Technician', email: 'former.technician@example.com', isActive: false, role: 'IT_STAFF', mustChangePassword: false },

  { name: 'Taylor Admin', email: 'taylor.admin@example.com', isActive: true, role: 'ADMINISTRATOR', mustChangePassword: false },
]

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10)

  for (const name of CATEGORIES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  for (const name of RELATED_SYSTEMS) {
    await prisma.relatedSystem.upsert({
      where: { name },
      update: {},
      create: { name },
    })
  }

  for (const user of USERS) {
    const existing = await prisma.user.findUnique({ where: { email: user.email } })

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: user.name,
          isActive: user.isActive,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          // Only seed the password hash the row doesn't have a real one yet (e.g. the
          // placeholder '' left by the Lab 2 -> Lab 3 migration). Never overwrite a password a
          // user has since actually changed.
          ...(existing.passwordHash === '' ? { passwordHash } : {}),
        },
      })
    } else {
      await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          isActive: user.isActive,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          passwordHash,
        },
      })
    }
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
