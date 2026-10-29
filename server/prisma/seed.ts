import bcrypt from 'bcryptjs'
import { prisma } from '../src/prisma'
import type { Priority, TicketStatus } from '../generated/prisma'

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

// First real Ticket seed data in this project -- Lab 3's seed script never created any Tickets at
// all, so the Ticket Queue/Dashboards/Actions Taken all had zero sample data to demonstrate against
// until now. Ticket numbers are the upsert key (idempotent, safe to re-run), covering every status,
// a mix of priorities, and both assigned and unassigned ownership, per Lab 4's seed requirement.
interface SeedTicket {
  ticketNumber: string
  requesterEmail: string
  ownerEmail: string | null
  categoryName: string
  relatedSystemName: string
  summary: string
  description: string
  requestedPriority: Priority
  itPriority: Priority
  currentStatus: TicketStatus
}

const TICKETS: SeedTicket[] = [
  {
    ticketNumber: 'TKT-SEED-000001',
    requesterEmail: 'jennifer.anderson@example.com',
    ownerEmail: null,
    categoryName: 'Hardware',
    relatedSystemName: 'Corporate Laptop',
    summary: 'Laptop battery drains quickly',
    description: 'Battery drains much faster than usual even when the system is idle.',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    currentStatus: 'NEW',
  },
  {
    ticketNumber: 'TKT-SEED-000002',
    requesterEmail: 'michael.brown@example.com',
    ownerEmail: null,
    categoryName: 'Network',
    relatedSystemName: 'VPN',
    summary: 'Cannot connect to VPN from home',
    description: 'VPN client fails to establish a tunnel, times out after about 30 seconds.',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'OPEN',
  },
  {
    ticketNumber: 'TKT-SEED-000003',
    requesterEmail: 'sarah.wilson@example.com',
    ownerEmail: 'priya.nakamura@example.com',
    categoryName: 'Software',
    relatedSystemName: 'Grade Submission App',
    summary: 'Grade Submission App freezes on save',
    description: 'The app becomes unresponsive a few seconds after clicking Save.',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'IN_PROGRESS',
  },
  {
    ticketNumber: 'TKT-SEED-000004',
    requesterEmail: 'david.lee@example.com',
    ownerEmail: 'carlos.mendez@example.com',
    categoryName: 'Account and Access',
    relatedSystemName: 'Email',
    summary: 'Need confirmation before resetting mailbox rules',
    description: 'Requested a change to inbox rules; waiting on the Requester to confirm which rules to keep.',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    currentStatus: 'WAITING_FOR_REQUESTER',
  },
  {
    ticketNumber: 'TKT-SEED-000005',
    requesterEmail: 'jennifer.anderson@example.com',
    ownerEmail: 'aisha.rahman@example.com',
    categoryName: 'Network',
    relatedSystemName: 'Campus Wi-Fi',
    summary: 'Wi-Fi disconnects randomly in the library',
    description: 'Connection drops every 10-15 minutes while on the library network.',
    requestedPriority: 'MEDIUM',
    itPriority: 'MEDIUM',
    currentStatus: 'RESOLVED',
  },
  {
    ticketNumber: 'TKT-SEED-000006',
    requesterEmail: 'michael.brown@example.com',
    ownerEmail: 'priya.nakamura@example.com',
    categoryName: 'Hardware',
    relatedSystemName: 'Printer',
    summary: 'Printer offline after firmware update',
    description: 'Printer shows offline in the OS after the latest firmware update was applied.',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    currentStatus: 'CLOSED',
  },
  {
    ticketNumber: 'TKT-SEED-000007',
    requesterEmail: 'sarah.wilson@example.com',
    ownerEmail: null,
    categoryName: 'Software',
    relatedSystemName: 'LEB2 App',
    summary: 'Duplicate submissions appearing in LEB2',
    description: 'The same submission appears twice in the review queue after resubmitting once.',
    requestedPriority: 'HIGH',
    itPriority: 'HIGH',
    currentStatus: 'REOPENED',
  },
  {
    ticketNumber: 'TKT-SEED-000008',
    requesterEmail: 'david.lee@example.com',
    ownerEmail: null,
    categoryName: 'Account and Access',
    relatedSystemName: 'Email',
    summary: 'Requested mailbox export, no longer needed',
    description: 'Original requester confirmed this is no longer needed after switching departments.',
    requestedPriority: 'LOW',
    itPriority: 'LOW',
    currentStatus: 'CANCELLED',
  },
]

interface SeedAction {
  ticketNumber: string
  performedByEmail: string
  description: string
  result: string
  followUpRequired: boolean
  followUpNote?: string
  attachmentNotes?: string
}

// Ticket 1: zero Actions Taken (still New). Ticket 3: exactly one. Ticket 4: several, including one
// with Follow-Up Required -- covers Lab 4's "zero, one, and multiple" seed requirement directly.
const ACTIONS: SeedAction[] = [
  {
    ticketNumber: 'TKT-SEED-000003',
    performedByEmail: 'priya.nakamura@example.com',
    description: 'Reproduced the freeze locally and captured a crash dump.',
    result: 'Confirmed a memory leak in the save handler; investigating a fix.',
    followUpRequired: false,
  },
  {
    ticketNumber: 'TKT-SEED-000004',
    performedByEmail: 'carlos.mendez@example.com',
    description: 'Drafted the proposed inbox rule changes for review.',
    result: 'Sent the Requester a summary of the proposed rules via Public Comment.',
    followUpRequired: true,
    followUpNote: 'Waiting on the Requester to confirm which rules to keep before applying anything.',
  },
  {
    ticketNumber: 'TKT-SEED-000004',
    performedByEmail: 'carlos.mendez@example.com',
    description: 'Checked current mailbox rule configuration against the request.',
    result: 'Confirmed two of the three requested rules are already in place.',
    followUpRequired: false,
    attachmentNotes: 'See rules-export.png for the current rule list screenshot.',
  },
  {
    ticketNumber: 'TKT-SEED-000004',
    performedByEmail: 'carlos.mendez@example.com',
    description: 'Followed up with the Requester by phone.',
    result: 'Left a voicemail; no response yet.',
    followUpRequired: true,
    followUpNote: 'Try again in 2 business days if no response.',
  },
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

  for (const t of TICKETS) {
    const [requester, owner, category, relatedSystem] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { email: t.requesterEmail } }),
      t.ownerEmail ? prisma.user.findUniqueOrThrow({ where: { email: t.ownerEmail } }) : null,
      prisma.category.findUniqueOrThrow({ where: { name: t.categoryName } }),
      prisma.relatedSystem.findUniqueOrThrow({ where: { name: t.relatedSystemName } }),
    ])

    await prisma.ticket.upsert({
      where: { ticketNumber: t.ticketNumber },
      update: {},
      create: {
        ticketNumber: t.ticketNumber,
        requesterId: requester.id,
        ticketOwnerId: owner?.id ?? null,
        categoryId: category.id,
        relatedSystemId: relatedSystem.id,
        summary: t.summary,
        description: t.description,
        requestedPriority: t.requestedPriority,
        itPriority: t.itPriority,
        currentStatus: t.currentStatus,
      },
    })
  }

  for (const a of ACTIONS) {
    const [ticket, performedBy] = await Promise.all([
      prisma.ticket.findUniqueOrThrow({ where: { ticketNumber: a.ticketNumber } }),
      prisma.user.findUniqueOrThrow({ where: { email: a.performedByEmail } }),
    ])
    const existing = await prisma.actionTaken.findFirst({
      where: { ticketId: ticket.id, description: a.description },
    })
    if (!existing) {
      await prisma.actionTaken.create({
        data: {
          ticketId: ticket.id,
          performedById: performedBy.id,
          description: a.description,
          result: a.result,
          followUpRequired: a.followUpRequired,
          followUpNote: a.followUpRequired ? (a.followUpNote ?? null) : null,
          attachmentNotes: a.attachmentNotes ?? null,
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
