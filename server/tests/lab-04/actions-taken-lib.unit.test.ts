import { describe, expect, it } from 'vitest'
import { validateActionBody } from '../../src/routes/staff'

const VALID = { description: 'A valid description here.', result: 'A valid result here.', followUpRequired: false }

describe('validateActionBody (BR-03, BR-04, BR-05)', () => {
  it('accepts a minimal valid body with followUpRequired false', () => {
    const result = validateActionBody(VALID)
    expect(result).toEqual({
      ok: true,
      description: VALID.description,
      result: VALID.result,
      followUpRequired: false,
      followUpNote: null,
      attachmentNotes: null,
    })
  })

  it('rejects description/result outside 3-2000 characters', () => {
    expect(validateActionBody({ ...VALID, description: 'ab' })).toMatchObject({ ok: false })
    expect(validateActionBody({ ...VALID, description: 'x'.repeat(2001) })).toMatchObject({ ok: false })
    expect(validateActionBody({ ...VALID, result: 'ab' })).toMatchObject({ ok: false })
    expect(validateActionBody({ ...VALID, result: 'x'.repeat(2001) })).toMatchObject({ ok: false })
  })

  it('rejects a non-boolean followUpRequired', () => {
    expect(validateActionBody({ ...VALID, followUpRequired: 'yes' })).toMatchObject({ ok: false })
    expect(validateActionBody({ ...VALID, followUpRequired: undefined })).toMatchObject({ ok: false })
  })

  it('requires a 3-2000 character followUpNote when followUpRequired is true', () => {
    expect(validateActionBody({ ...VALID, followUpRequired: true })).toMatchObject({ ok: false })
    expect(validateActionBody({ ...VALID, followUpRequired: true, followUpNote: 'ab' })).toMatchObject({ ok: false })

    const result = validateActionBody({ ...VALID, followUpRequired: true, followUpNote: 'Follow up in two days.' })
    expect(result).toMatchObject({ ok: true, followUpRequired: true, followUpNote: 'Follow up in two days.' })
  })

  it('discards a supplied followUpNote when followUpRequired is false', () => {
    const result = validateActionBody({ ...VALID, followUpRequired: false, followUpNote: 'Should be dropped.' })
    expect(result).toMatchObject({ ok: true, followUpNote: null })
  })

  it('rejects attachmentNotes over 500 characters, accepts it within range, and omits it when blank', () => {
    expect(validateActionBody({ ...VALID, attachmentNotes: 'x'.repeat(501) })).toMatchObject({ ok: false })
    expect(validateActionBody({ ...VALID, attachmentNotes: 'See screenshot.png' })).toMatchObject({
      ok: true,
      attachmentNotes: 'See screenshot.png',
    })
    expect(validateActionBody({ ...VALID, attachmentNotes: '' })).toMatchObject({ ok: true, attachmentNotes: null })
  })
})
